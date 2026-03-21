'use client';

import { useEffect, useState } from 'react';

interface UnusedItem {
  name: string;
  type: string;
  reason: string;
  severity: 'warning' | 'info';
  system: boolean;
}

interface UnusedData {
  summary: {
    total: number;
    totalSystem: number;
    warnings: number;
    info: number;
    byType: {
      deployments: number;
      services: number;
      helmCharts: number;
      configmaps: number;
      serviceMonitors: number;
    };
  };
  items: UnusedItem[];
}

const TYPE_COLORS: Record<string, string> = {
  'Deployment':     '#7dd3fc',
  'Service':        '#86efac',
  'Helm Chart':     '#c084fc',
  'ConfigMap':      '#fbbf24',
  'ServiceMonitor': '#fb923c',
};

export default function UnusedResources() {
  const [data, setData]           = useState<UnusedData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<string>('all');
  const [search, setSearch]       = useState('');
  const [showSystem, setShowSystem] = useState(false);

  useEffect(() => {
    fetch('/api/unused')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-panel p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-zinc-800/50 rounded" />)}
      </div>
    );
  }

  if (!data) return null;

  const appItems    = data.items.filter(i => !i.system);
  const systemItems = data.items.filter(i => i.system);
  const types = ['all', 'Deployment', 'Service', 'Helm Chart', 'ConfigMap', 'ServiceMonitor'];

  const filtered = appItems.filter(item => {
    const matchType   = filter === 'all' || item.type === filter;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const filteredSystem = systemItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Unused / Orphaned Resources</h3>
          {data.summary.warnings > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              {data.summary.warnings} warnings
            </span>
          )}
          {data.summary.info > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
              {data.summary.info} info
            </span>
          )}
          {data.summary.totalSystem > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-600 border border-zinc-700/30">
              {data.summary.totalSystem} system (excluded)
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 border border-white/5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30 w-32"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => {
          const count = t === 'all' ? appItems.length : appItems.filter(i => i.type === t).length;
          if (t !== 'all' && count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-xs px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5"
              style={{
                background: filter === t ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                color:      filter === t ? '#22d3ee' : '#71717a',
                border:     `1px solid ${filter === t ? 'rgba(34,211,238,0.2)' : 'transparent'}`,
              }}
            >
              {t !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[t] || '#71717a' }} />}
              {t} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 text-[10px] uppercase tracking-widest text-zinc-600 px-2">
        <div className="col-span-1">Sev</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-4">Name</div>
        <div className="col-span-5">Reason</div>
      </div>

      {/* App resource rows */}
      <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            {appItems.length === 0 ? '✨ No unused app resources found!' : 'No items match your filter'}
          </div>
        ) : filtered.map((item, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-1 px-2 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="col-span-1">
              <span className="text-sm">{item.severity === 'warning' ? '🟡' : 'ℹ️'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: `${TYPE_COLORS[item.type] || '#71717a'}18`, color: TYPE_COLORS[item.type] || '#71717a' }}>
                {item.type}
              </span>
            </div>
            <div className="col-span-4">
              <span className="text-xs font-mono text-zinc-200 truncate block">{item.name}</span>
            </div>
            <div className="col-span-5">
              <span className="text-xs text-zinc-500">{item.reason}</span>
            </div>
          </div>
        ))}
      </div>

      {/* System resources — collapsed by default */}
      {filteredSystem.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <button
            onClick={() => setShowSystem(s => !s)}
            className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors w-full"
          >
            <span className="transition-transform duration-200" style={{ display: 'inline-block', transform: showSystem ? 'rotate(90deg)' : 'none' }}>›</span>
            <span>System / Infrastructure resources ({filteredSystem.length}) — K8s internals, excluded from warnings</span>
          </button>

          {showSystem && (
            <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {filteredSystem.map((item, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-1 px-2 py-1.5 rounded-lg opacity-50"
                  style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="col-span-1"><span className="text-sm">⚙️</span></div>
                  <div className="col-span-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded text-zinc-600 bg-zinc-800">{item.type}</span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs font-mono text-zinc-500 truncate block">{item.name}</span>
                  </div>
                  <div className="col-span-5">
                    <span className="text-xs text-zinc-600">{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="text-[10px] text-zinc-600 text-right pt-1 border-t border-white/5">
          {filtered.length} app resource{filtered.length !== 1 ? 's' : ''} · consider cleaning up warnings to reduce cluster noise
        </div>
      )}
    </div>
  );
}