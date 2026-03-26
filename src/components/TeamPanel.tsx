'use client';

import { useEffect, useState } from 'react';

interface ServiceItem {
  name: string;
  type: string;
  ownerTeam: string;
  id: string;
}

interface TeamPanelProps {
  team: string;
  color: string;
  onSelectService: (name: string) => void;
  onClose: () => void;
  inline?: boolean; // when true, renders without glass-panel wrapper
}

export default function TeamPanel({ team, color, onSelectService, onClose, inline = false }: TeamPanelProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search] = useState('');

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

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-sm font-bold text-zinc-100">{displayName}</span>
          {isUnowned && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              missing owner_team label
            </span>
          )}
          <span className="text-xs text-zinc-500">{services.length} services</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm leading-none">✕</button>
      </div>

      {/* Unowned warning */}
      {isUnowned && filtered.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <span>⚠️</span>
          <span className="text-red-300">
            Missing <code className="text-red-200 bg-red-500/10 px-1 rounded">owner_team</code> label — add it to hold teams accountable.
          </span>
        </div>
      )}

      {/* Service list */}
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-zinc-800/50 rounded animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-4 text-zinc-600 text-sm">No services found</div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {filtered.map(svc => (
            <button key={svc.id} onClick={() => onSelectService(svc.name)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all group"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.background = `${color}0a`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors truncate font-mono">{svc.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="text-[10px] text-zinc-600 border-t border-white/5 pt-2">
        Click any service to inspect
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="space-y-3 border-t border-white/5 pt-4">
        {content}
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 space-y-4" style={{ borderColor: `${color}30` }}>
      {content}
    </div>
  );
}