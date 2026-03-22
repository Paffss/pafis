'use client';

import { useEffect, useState, useCallback } from 'react';

interface HealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  responseMs: number;
  uptime: { seconds: number; human: string };
  graph: { status: string; nodes?: number; edges?: number; deployments?: number; services?: number; helmCharts?: number; error?: string };
  data: { status: string; totalYamlFiles: number; paths: Record<string, { exists: boolean; files: number }> };
  prometheus: { status: string; url: string; latencyMs: number | null };
  ai: { status: string; provider: string; note: string };
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
  system: { nodeVersion: string; platform: string; cpus: number; freeMem: number; totalMem: number };
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'ok' || status === 'healthy';
  const warn = status === 'degraded' || status === 'unavailable' || status === 'unconfigured' || status === 'empty';
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: ok ? 'rgba(34,197,94,0.15)' : warn ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
        color: ok ? '#4ade80' : warn ? '#fbbf24' : '#f87171',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : warn ? 'rgba(251,191,36,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
      {ok ? '✓ ' : '⚠ '}{status}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-200 font-mono">{children}</span>
    </div>
  );
}

export default function HealthPage() {
  const [data, setData]         = useState<HealthData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch('/api/health')
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date()); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetch_]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cyber-bg" />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-zinc-100">PAFIS Health</h1>
              {data && <StatusBadge status={data.status} />}
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {lastRefresh ? `Last checked ${lastRefresh.toLocaleTimeString()}` : 'Checking...'}
              {data && ` · ${data.responseMs}ms response`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetch_}
              className="text-sm px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: '#22d3ee' }}>
              {loading ? 'Refreshing...' : '↺ Refresh'}
            </button>
            <a href="/"
              className="text-sm px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              ← Dashboard
            </a>
          </div>
        </div>

        {!data ? (
          <div className="glass-panel p-8 text-center text-zinc-500 animate-pulse">Loading health data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Graph */}
            <Section title="Infrastructure Graph">
              <Row label="Status"><StatusBadge status={data.graph.status} /></Row>
              {data.graph.error ? (
                <p className="text-sm text-red-400 font-mono">{data.graph.error}</p>
              ) : (
                <>
                  <Row label="Total Nodes">{data.graph.nodes?.toLocaleString()}</Row>
                  <Row label="Total Edges">{data.graph.edges?.toLocaleString()}</Row>
                  <Row label="Deployments">{data.graph.deployments}</Row>
                  <Row label="Services">{data.graph.services}</Row>
                  <Row label="Helm Charts">{data.graph.helmCharts}</Row>
                </>
              )}
            </Section>

            {/* Data */}
            <Section title="Data Sources">
              <Row label="Status"><StatusBadge status={data.data.status} /></Row>
              <Row label="Total YAML Files">{data.data.totalYamlFiles}</Row>
              {Object.entries(data.data.paths).map(([key, info]) => (
                <Row key={key} label={key}>
                  <span style={{ color: info.exists ? '#4ade80' : '#f87171' }}>
                    {info.exists ? `${info.files} files` : 'not found'}
                  </span>
                </Row>
              ))}
            </Section>

            {/* Prometheus */}
            <Section title="Prometheus">
              <Row label="Status"><StatusBadge status={data.prometheus.status} /></Row>
              <Row label="URL">{data.prometheus.url}</Row>
              <Row label="Latency">{data.prometheus.latencyMs != null ? `${data.prometheus.latencyMs}ms` : '—'}</Row>
            </Section>

            {/* AI */}
            <Section title="AI Provider">
              <Row label="Status"><StatusBadge status={data.ai.status} /></Row>
              <Row label="Provider">{data.ai.provider}</Row>
              <Row label="Note">{data.ai.note}</Row>
            </Section>

            {/* Memory */}
            <Section title="Memory">
              <Row label="Heap Used">{data.memory.heapUsedMb} MB</Row>
              <Row label="Heap Total">{data.memory.heapTotalMb} MB</Row>
              <Row label="RSS">{data.memory.rssMb} MB</Row>
            </Section>

            {/* System */}
            <Section title="System">
              <Row label="Uptime">{data.uptime.human}</Row>
              <Row label="Node.js">{data.system.nodeVersion}</Row>
              <Row label="Platform">{data.system.platform}</Row>
              <Row label="CPUs">{data.system.cpus}</Row>
              <Row label="Free Memory">{data.system.freeMem} MB / {data.system.totalMem} MB</Row>
            </Section>

          </div>
        )}

        <p className="text-xs text-zinc-700 text-center">Auto-refreshes every 30 seconds · <code>/api/health</code> returns JSON for monitoring integrations</p>
      </div>
    </div>
  );
}