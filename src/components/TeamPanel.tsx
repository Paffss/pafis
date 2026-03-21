'use client';

import { useEffect, useState } from 'react';

interface ServiceItem {
  name: string;
  type: string;
  ownerTeam: string;
  id: string;
}

interface TeamPanelProps {
  team: string; // team name or 'unknown' for unowned
  color: string;
  onSelectService: (name: string) => void;
  onClose: () => void;
}

export default function TeamPanel({ team, color, onSelectService, onClose }: TeamPanelProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then((all: ServiceItem[]) => {
        const filtered = all.filter(s =>
          team === 'unknown'
            ? !s.ownerTeam || s.ownerTeam === 'unknown'
            : s.ownerTeam === team
        );
        setServices(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [team]);

  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const isUnowned = team === 'unknown';
  const displayName = isUnowned ? 'Unowned Services' : team;

  return (
    <div className="glass-panel p-5 space-y-4"
      style={{ borderColor: `${color}30` }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
          <h3 className="text-base font-bold text-zinc-100">{displayName}</h3>
          {isUnowned && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              missing owner_team label
            </span>
          )}
          <span className="text-sm text-zinc-500">{services.length} services</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm px-2 py-1 rounded bg-zinc-800 border border-white/5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30 w-32"
          />
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Unowned warning */}
      {isUnowned && filtered.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <span>⚠️</span>
          <span className="text-red-300">
            These deployments are missing the <code className="text-red-200 bg-red-500/10 px-1 rounded">owner_team</code> label.
            Add it to your Kubernetes deployment manifests so teams can be held accountable for their services.
          </span>
        </div>
      )}

      {/* Service grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-zinc-600 text-sm">No services found</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map(svc => (
            <button
              key={svc.id}
              onClick={() => onSelectService(svc.name)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${color}40`;
                e.currentTarget.style.background = `${color}0a`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors truncate font-mono">
                {svc.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-600 border-t border-white/5 pt-2">
        Click any service to inspect its dependency graph, AI analysis and cost breakdown
      </div>
    </div>
  );
}