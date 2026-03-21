'use client';

import { useEffect, useState } from 'react';

interface ServiceRisk {
  name: string;
  team: string;
  critical: string[];
  warnings: string[];
  score: number;
}

interface RiskSummaryProps {
  onSelectService: (name: string) => void;
}

export default function RiskSummary({ onSelectService }: RiskSummaryProps) {
  const [risks, setRisks] = useState<ServiceRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warnings'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/risks')
      .then(r => r.json())
      .then(data => { setRisks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = risks
    .filter(r => {
      if (filter === 'critical') return r.critical.length > 0;
      if (filter === 'warnings') return r.critical.length === 0 && r.warnings.length > 0;
      return true;
    })
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.team.toLowerCase().includes(search.toLowerCase()));

  const totalCritical = risks.filter(r => r.critical.length > 0).length;
  const totalWarnings = risks.filter(r => r.critical.length === 0 && r.warnings.length > 0).length;
  const healthyCount  = risks.length === 0 ? 0 : 0; // populated after load

  if (loading) {
    return (
      <div className="glass-panel p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-zinc-800/50 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Cluster Risk Summary</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
            {totalCritical} critical
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
            {totalWarnings} warnings
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Filter services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-white/5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30 w-36"
          />
          {/* Filter pills */}
          {(['all', 'critical', 'warnings'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-2 py-1 rounded transition-all capitalize"
              style={{
                background: filter === f ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                color:      filter === f ? '#22d3ee' : '#71717a',
                border:     `1px solid ${filter === f ? 'rgba(34,211,238,0.2)' : 'transparent'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 text-[10px] uppercase tracking-widest text-zinc-600 px-2">
        <div className="col-span-3">Service</div>
        <div className="col-span-2">Team</div>
        <div className="col-span-5">Issues</div>
        <div className="col-span-2 text-right">Score</div>
      </div>

      {/* Risk rows */}
      <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            {search ? 'No services match your search' : 'No issues found 🎉'}
          </div>
        ) : filtered.map(risk => (
          <button
            key={risk.name}
            onClick={() => onSelectService(risk.name)}
            className="w-full grid grid-cols-12 items-start gap-1 px-2 py-2.5 rounded-lg text-left transition-all hover:bg-white/3 group"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,211,238,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            {/* Name */}
            <div className="col-span-3 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
                style={{ background: risk.critical.length > 0 ? '#f87171' : '#fbbf24' }}
              />
              <span className="text-xs text-zinc-200 group-hover:text-cyan-400 transition-colors truncate font-mono">
                {risk.name}
              </span>
            </div>

            {/* Team */}
            <div className="col-span-2">
              <span className="text-[10px] text-zinc-500 truncate">{risk.team}</span>
            </div>

            {/* Issues */}
            <div className="col-span-5 flex flex-wrap gap-1">
              {risk.critical.map(c => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/15">
                  {c}
                </span>
              ))}
              {risk.warnings.map(w => (
                <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/15">
                  {w}
                </span>
              ))}
            </div>

            {/* Score */}
            <div className="col-span-2 text-right">
              <span
                className="text-xs font-mono font-bold"
                style={{ color: risk.score >= 30 ? '#f87171' : risk.score >= 15 ? '#fbbf24' : '#6b7280' }}
              >
                {risk.score}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="text-[10px] text-zinc-600 text-right pt-1 border-t border-white/5">
          {filtered.length} service{filtered.length !== 1 ? 's' : ''} with issues
          {search || filter !== 'all' ? ` (filtered from ${risks.length})` : ''}
          {' · '}click any row to inspect
        </div>
      )}
    </div>
  );
}