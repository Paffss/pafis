import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_PROVIDER, ANTHROPIC_API_KEY } from '@/lib/config';
import { streamOllama } from '@/lib/ai/ollama';
import { findNodeByName, getServiceSubgraph, getServiceFamily } from '@/lib/graph/query';
import { recordUsage } from '@/lib/ai/usage-tracker';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for AI responses
const analysisCache = new Map<string, string>();

function getServiceContext(name: string) {
  const node = findNodeByName(name);
  if (!node) return null;

  const subgraph = getServiceSubgraph(name, 1);
  const family = getServiceFamily(name);

  const configmaps = subgraph.nodes.filter(n => n.type === 'configmap').map(n => n.name);
  const secrets = subgraph.nodes.filter(n => n.type === 'secret').map(n => n.name);
  const databases = subgraph.nodes.filter(n => n.type === 'database').map(n => n.name);
  const ingressHosts = subgraph.nodes.filter(n => n.type === 'ingress').flatMap(n => n.metadata.hosts || []);

  const cmSummary = node.metadata.configMapKeys
    ? Object.entries(node.metadata.configMapKeys)
        .filter(([cm]) => cm !== 'generic' && cm !== 'features')
        .map(([cm, keys]) => `${cm}: ${(keys as string[]).slice(0, 8).join(', ')}`)
        .join('; ')
    : '';

  const ctx = `SERVICE: ${name} | TEAM: ${node.metadata.ownerTeam || '?'} | ${node.metadata.framework || '?'}/${node.metadata.tech || '?'}
REPLICAS: ${node.metadata.replicas || '?'} | CPU: ${node.metadata.cpuRequest || 'none'}/${node.metadata.cpuLimit || 'no limit'} | MEM: ${node.metadata.memoryRequest || 'none'}/${node.metadata.memoryLimit || 'no limit'}
IMAGE: ${node.metadata.image || '?'}
PROBES: liveness=${node.metadata.hasLivenessProbe ? 'yes' : 'NO'}, readiness=${node.metadata.hasReadinessProbe ? 'yes' : 'NO'}
PORTS: ${node.metadata.ports?.map(p => `${p.name}:${p.port}`).join(', ') || 'none'}
INGRESS: ${ingressHosts.length > 0 ? ingressHosts.slice(0, 5).join(', ') : 'none'}
CONFIGMAPS: ${configmaps.join(', ')}${cmSummary ? ' (' + cmSummary + ')' : ''}
SECRETS: ${secrets.join(', ') || 'none'}
DATABASES: ${databases.join(', ') || 'none'}
FAMILY: ${family.map(f => `${f.name}(${f.metadata.replicas}r)`).join(', ') || 'standalone'}`;

  return ctx;
}

interface Stage {
  header: string;
  prompt: string;
  maxTokens: number;
}

function getStages(ctx: string): Stage[] {
  return [
    {
      header: '## Purpose\n',
      prompt: `You are a senior SRE analyzing a Kubernetes service. In 2-3 sentences, explain what this service does and its role in the architecture. Infer from the name, image, configmaps, secrets, and database connections. Be specific and technical.

${ctx}

Respond with just the description, no heading, no bullet points.`,
      maxTokens: 150,
    },
    {
      header: '\n## Risks\n',
      prompt: `You are a senior SRE doing a production readiness review. List ALL risks for this K8s service. Format EXACTLY like this, each risk as its own paragraph separated by a blank line:

🔴 No CPU limits set — pod can consume unbounded CPU, causing noisy neighbor issues

🟡 Single replica — no redundancy, any pod failure causes downtime

🔴 No PodDisruptionBudget — rolling updates or node drains can take the service fully offline

Check for: missing resource limits, missing requests, single replica SPOF, missing liveness probe, missing readiness probe, no PDB, no HPA, secrets mounted as env vars, no network policy, missing memory limits. 
Use 🔴 for critical, 🟡 for warning. Be specific about the blast radius of each risk.

${ctx}`,
      maxTokens: 400,
    },
    {
      header: '\n## Improvements\n',
      prompt: `You are a senior SRE. List the top 5 concrete improvements for this K8s service, prioritized by impact. Format EXACTLY like this:
- Add CPU/memory limits to prevent noisy neighbor issues
- Configure PDB with minAvailable: 1 to survive node drains
- Add HPA to auto-scale based on CPU utilization

Each on its own line starting with "- ". Be specific and actionable, not generic.

${ctx}`,
      maxTokens: 250,
    },
    {
      header: '\n## Security\n',
      prompt: `You are a Kubernetes security expert. Analyze this service for security issues. Format EXACTLY like this, each issue as its own paragraph separated by a blank line:

🔴 Secrets likely mounted as environment variables — exposed in pod spec and logs

🟡 No NetworkPolicy defined — service can receive traffic from any pod in the cluster

🔴 Container likely running as root — no securityContext defined

Check for: secrets as env vars, missing securityContext (runAsNonRoot, readOnlyRootFilesystem), no NetworkPolicy, missing RBAC, privileged containers, no resource quotas, exposed sensitive configmap keys (passwords, tokens, keys). 
Use 🔴 for critical, 🟡 for warning.

${ctx}`,
      maxTokens: 350,
    },
    {
      header: '\n## Dependencies\n',
      prompt: `You are a senior SRE. List this service's dependencies based on the context. Format EXACTLY like this:
- **Databases:** db1, db2 (or "none")
- **Services:** svc1, svc2 (or "none")
- **Messaging:** kafka, rabbitmq (or "none")
- **Cache:** redis, memcached (or "none")
- **External:** sentry, keycloak, datadog (or "none")

Each on its own line starting with "- **Type:**". Only include what you can infer from the data.

${ctx}`,
      maxTokens: 200,
    },
  ];
}

function streamAnthropic(prompt: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
        let fullResponse = '';
        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        // Capture token usage from the final message
        const finalMessage = await messageStream.finalMessage();
        if (finalMessage.usage) {
          controller.enqueue(encoder.encode(
            `\n<!--tokens:${finalMessage.usage.input_tokens}:${finalMessage.usage.output_tokens}-->`
          ));
        }

        controller.close();
        return fullResponse;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n**Error:** ${errMsg}`));
        controller.close();
        return '';
      }
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Check cache first
  const cached = analysisCache.get(name);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const ctx = getServiceContext(name);
  if (!ctx) {
    return new Response('Service not found', { status: 404 });
  }

  const stages = getStages(ctx);
  const encoder = new TextEncoder();

  // Stream stages sequentially
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        for (const stage of stages) {
          // Write stage header
          controller.enqueue(encoder.encode(stage.header));
          fullResponse += stage.header;

          // Get AI response for this stage
          let stageStream: ReadableStream<Uint8Array>;
          if (AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
            stageStream = streamAnthropic(stage.prompt);
          } else {
            stageStream = streamOllama(stage.prompt, stage.maxTokens);
          }

          // Pipe stage stream through
          const reader = stageStream.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        analysisCache.set(name, fullResponse);

        // Extract and record token usage from hidden comments
        const tokenMatches = [...fullResponse.matchAll(/<!--tokens:(\d+):(\d+)-->/g)];
        if (tokenMatches.length > 0) {
          const totalInput  = tokenMatches.reduce((s, m) => s + parseInt(m[1]), 0);
          const totalOutput = tokenMatches.reduce((s, m) => s + parseInt(m[2]), 0);
          recordUsage(name, totalInput, totalOutput);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n**Error:** ${errMsg}`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}