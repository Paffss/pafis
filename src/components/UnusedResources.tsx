'use client';

import { useEffect, useState } from 'react';

interface UnusedItem {
  name: string;
  type: string;
  reason: string;
  severity: 'warning' | 'info';
}

interface UnusedData {
  summary: {
    total: number;
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
  const [data, setData]       = useState<UnusedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>('all');
  const [search, setSearch]   = useState('');

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

  const types = ['all', 'Deployment', 'Service', 'Helm Chart', 'ConfigMap', 'ServiceMonitor'];

  const filtered = data.items.filter(item => {
    const matchType   = filter === 'all' || item.type === filter;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

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
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-white/5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30 w-32"
          />
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => {
          const count = t === 'all' ? data.summary.total
            : data.items.filter(i => i.type === t).length;
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
              {t !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[t] || '#71717a' }} />
              )}
              {t} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      {filter === 'all' && (
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(data.summary.byType).map(([key, count]) => {
            if (count === 0) return null;
            const label = key === 'helmCharts' ? 'Helm Charts'
              : key === 'serviceMonitors' ? 'Monitors'
              : key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <button
                key={key}
                onClick={() => setFilter(label === 'Monitors' ? 'ServiceMonitor' : label.slice(0, -1))}
                className="text-center p-2 rounded-lg transition-all hover:bg-white/3"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="text-lg font-bold text-zinc-200">{count}</div>
                <div className="text-[10px] text-zinc-500">{label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-12 text-[10px] uppercase tracking-widest text-zinc-600 px-2">
        <div className="col-span-1">Sev</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-4">Name</div>
        <div className="col-span-5">Reason</div>
      </div>

      {/* Items */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-sm">
            {data.summary.total === 0 ? '✨ No unused resources found!' : 'No items match your filter'}
          </div>
        ) : filtered.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center gap-1 px-2 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            {/* Severity */}
            <div className="col-span-1">
              <span className="text-sm">
                {item.severity === 'warning' ? '🟡' : 'ℹ️'}
              </span>
            </div>
            {/* Type */}
            <div className="col-span-2">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: `${TYPE_COLORS[item.type] || '#71717a'}18`,
                  color: TYPE_COLORS[item.type] || '#71717a',
                }}
              >
                {item.type}
              </span>
            </div>
            {/* Name */}
            <div className="col-span-4">
              <span className="text-xs font-mono text-zinc-200 truncate block">{item.name}</span>
            </div>
            {/* Reason */}
            <div className="col-span-5">
              <span className="text-xs text-zinc-500">{item.reason}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="text-[10px] text-zinc-600 text-right border-t border-white/5 pt-2">
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
          {data.summary.total > 0 && ' · consider cleaning up warnings to reduce cluster noise'}
        </div>
      )}
    </div>
  );
}