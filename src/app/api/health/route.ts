import { NextResponse } from 'next/server';
import { getGraph, getGraphStats } from '@/lib/graph/builder';
import { DATA_PATHS, PROMETHEUS_URL, AI_PROVIDER, ANTHROPIC_API_KEY, OLLAMA_URL } from '@/lib/config';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';

function checkDataPaths() {
  const results: Record<string, { exists: boolean; files: number }> = {};
  for (const [key, dirPath] of Object.entries(DATA_PATHS)) {
    try {
      const exists = fs.existsSync(dirPath);
      const files = exists
        ? fs.readdirSync(dirPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length
        : 0;
      results[key] = { exists, files };
    } catch {
      results[key] = { exists: false, files: 0 };
    }
  }
  return results;
}

async function checkPrometheus(): Promise<{ reachable: boolean; latencyMs: number | null }> {
  const start = Date.now();
  try {
    // Parse credentials from URL if present (e.g. https://user:pass@host/path)
    // Use a sanitised copy so the original string with credentials is never
    // passed to fetch() — Node 18+ undici throws on credentialed URLs.
    const parsedUrl = new URL(PROMETHEUS_URL);
    const username = decodeURIComponent(parsedUrl.username);
    const password = decodeURIComponent(parsedUrl.password);

    // Strip credentials BEFORE calling .toString() — undici inspects the
    // URL object itself, not just the string passed to fetch().
    parsedUrl.username = '';
    parsedUrl.password = '';
    const cleanBase = parsedUrl.toString().replace(/\/$/, '');

    const headers: Record<string, string> = {};
    if (username && password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    const res = await fetch(`${cleanBase}/-/healthy`, {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    return { reachable: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { reachable: false, latencyMs: null };
  }
}

async function checkAI(): Promise<{ configured: boolean; provider: string; note: string }> {
  if (AI_PROVIDER === 'anthropic') {
    return {
      configured: !!ANTHROPIC_API_KEY,
      provider: 'anthropic',
      note: ANTHROPIC_API_KEY ? 'API key set' : 'ANTHROPIC_API_KEY not set',
    };
  }
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return {
      configured: res.ok,
      provider: 'ollama',
      note: res.ok ? 'Ollama reachable' : 'Ollama not reachable',
    };
  } catch {
    return { configured: false, provider: 'ollama', note: 'Ollama not reachable' };
  }
}

export async function GET() {
  const startTime = Date.now();

  const [prometheus, ai] = await Promise.all([
    checkPrometheus(),
    checkAI(),
  ]);

  let graph;
  let stats;
  let graphError = null;
  try {
    graph = getGraph();
    stats = getGraphStats();
  } catch (e) {
    graphError = e instanceof Error ? e.message : 'Unknown error';
  }

  const dataPaths = checkDataPaths();
  const totalYamlFiles = Object.values(dataPaths).reduce((sum, d) => sum + d.files, 0);

  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  const healthy =
    !graphError &&
    (stats?.deployments ?? 0) > 0 &&
    ai.configured;

  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    responseMs: Date.now() - startTime,
    uptime: {
      seconds: Math.round(uptime),
      human: formatUptime(uptime),
    },
    graph: graphError
      ? { status: 'error', error: graphError }
      : {
          status: 'ok',
          nodes: graph?.nodes.size ?? 0,
          edges: graph?.edges.length ?? 0,
          deployments: stats?.deployments ?? 0,
          services: stats?.services ?? 0,
          helmCharts: stats?.helmCharts ?? 0,
        },
    data: {
      status: totalYamlFiles > 0 ? 'ok' : 'empty',
      totalYamlFiles,
      paths: dataPaths,
    },
    prometheus: {
      status: prometheus.reachable ? 'ok' : 'unavailable',
      url: (() => { try { const u = new URL(PROMETHEUS_URL); u.username = ''; u.password = ''; return u.toString(); } catch { return '(invalid)'; } })(),
      latencyMs: prometheus.latencyMs,
    },
    ai: {
      status: ai.configured ? 'ok' : 'unconfigured',
      provider: ai.provider,
      note: ai.note,
    },
    memory: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
    },
    system: {
      nodeVersion: process.version,
      platform: os.platform(),
      cpus: os.cpus().length,
      freeMem: Math.round(os.freemem() / 1024 / 1024),
      totalMem: Math.round(os.totalmem() / 1024 / 1024),
    },
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}