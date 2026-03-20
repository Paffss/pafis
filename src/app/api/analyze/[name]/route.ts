import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_PROVIDER, ANTHROPIC_API_KEY } from '@/lib/config';
import { streamOllama } from '@/lib/ai/ollama';
import { findNodeByName, getServiceSubgraph, getServiceFamily } from '@/lib/graph/query';

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
      prompt: `K8s service. In 1-2 sentences, what does this service do? Infer from name, configmaps, secrets, databases.\n\n${ctx}\n\nRespond with just the description, no heading.`,
      maxTokens: 100,
    },
    {
      header: '\n## Risks\n',
      prompt: `K8s service. List risks. Format EXACTLY like this, each risk separated by a blank line:

🔴 No CPU limits set, risking noisy neighbor

🟡 Single replica is SPOF

🔴 No PodDisruptionBudget defined

Check: missing limits, SPOF, probe gaps, no PDB. Do NOT mention image tags or :latest. Each risk as its own paragraph with blank line between. No bullet points.

${ctx}`,
      maxTokens: 250,
    },
    {
      header: '\n## Improvements\n',
      prompt: `K8s service. List max 4 improvements. Format EXACTLY like this:
- Add CPU/memory limits
- Configure PDB with minAvailable

Each on its own line starting with "- ".

${ctx}`,
      maxTokens: 200,
    },
    {
      header: '\n## Dependencies\n',
      prompt: `K8s service. List dependencies. Format EXACTLY like this:
- **Databases:** db1, db2
- **Services:** svc1, svc2
- **Messaging:** kafka, rabbitmq
- **External:** sentry, keycloak

Each on its own line starting with "- **Type:**".

${ctx}`,
      maxTokens: 150,
    },
  ];
}

function streamAnthropic(prompt: string, _maxTokens = 800): ReadableStream<Uint8Array> {
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
