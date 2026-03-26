'use client';

import { useEffect, useState } from 'react';

interface ImpactNode {
  name: string;
  team: string;
  environment: string;
  hops: number;
}

interface ImpactData {
  dependsOn: ImpactNode[];
  affectedBy: ImpactNode[];
  criticalityScore: number;
  directCallers: number;
}

interface ImpactPanelProps {
  name: string;
  onSelectService: (name: string) => void;
}

const ENV_DOT: Record<string, string> = {
  production: '#ef4444', staging: '#eab308', qa: '#f97316',
  dev: '#22c55e', unknown: '#71717a',
};

const HOP_STYLE: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'rgba(239,68,68,0.12)',   text: '#fca5a5', label: 'direct'   },
  2: { bg: 'rgba(251,191,36,0.12)',  text: '#fde047', label: '2 hops'   },
  3: { bg: 'rgba(113,113,122,0.10)', text: '#a1a1aa', label: '3 hops'   },
  4: { bg: 'rgba(113,113,122,0.07)', text: '#71717a', label: '4+ hops'  },
};

function getCriticalityGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 50) return { grade: 'CRITICAL', color: '#ef4444', label: 'Many services depend on this' };
  if (score >= 25) return { grade: 'HIGH',     color: '#f97316', label: 'Several services depend on this' };
  if (score >= 10) return { grade: 'MEDIUM',   color: '#eab308', label: 'Some services depend on this' };
  if (score > 0)   return { grade: 'LOW',      color: '#22c55e', label: 'Few services depend on this' };
  return             { grade: 'LEAF',     color: '#71717a', label: 'No services depend on this' };
}

export default function ImpactPanel({ name, onSelectService }: ImpactPanelProps) {
  const [data, setData]       = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'affected' | 'depends'>('affected');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/impact/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  if (loading) return (
    <div className="glass-panel p-5 flex items-center justify-center h-32">
      <span className="text-zinc-500 text-sm">Analysing dependencies…</span>
    </div>
  );

  if (!data) return null;

  const criticality = getCriticalityGrade(data.criticalityScore);
  const activeList  = tab === 'affected' ? data.affectedBy : data.dependsOn;

  // Group affectedBy by hop count
  const grouped = activeList.reduce<Record<number, ImpactNode[]>>((acc, node) => {
    const hop = Math.min(node.hops, 4);
    acc[hop] = acc[hop] || [];
    acc[hop].push(node);
    return acc;
  }, {});

  return (
    <div className="glass-panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Dependency Impact
        </h3>
        {/* Criticality badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: `${criticality.color}18`, border: `1px solid ${criticality.color}40`, color: criticality.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: criticality.color }} />
            {criticality.grade}
          </div>
          {data.criticalityScore > 0 && (
            <span className="text-xs text-zinc-500">{criticality.label}</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox
          label="Blast radius"
          value={data.affectedBy.length.toString()}
          sub="services affected"
          color={data.affectedBy.length > 5 ? '#ef4444' : data.affectedBy.length > 2 ? '#f97316' : '#71717a'}
        />
        <StatBox
          label="Direct callers"
          value={data.directCallers.toString()}
          sub="call this directly"
          color={data.directCallers > 3 ? '#f97316' : '#71717a'}
        />
        <StatBox
          label="Depends on"
          value={data.dependsOn.length.toString()}
          sub="upstream services"
          color="#71717a"
        />
      </div>

      {/* Tabs */}
      {(data.affectedBy.length > 0 || data.dependsOn.length > 0) && (
        <>
          <div className="flex gap-1 border-b border-white/5">
            <TabBtn
              label={`Affected by failure (${data.affectedBy.length})`}
              active={tab === 'affected'}
              onClick={() => setTab('affected')}
              danger
            />
            <TabBtn
              label={`Depends on (${data.dependsOn.length})`}
              active={tab === 'depends'}
              onClick={() => setTab('depends')}
            />
          </div>

          {activeList.length === 0 ? (
            <p className="text-zinc-500 text-sm py-2">
              {tab === 'affected'
                ? 'No services depend on this — it is a leaf service.'
                : 'This service has no detected upstream dependencies.'}
            </p>
          ) : (
            <div className="space-y-3">
              {tab === 'affected' && (
                <p className="text-xs text-zinc-500">
                  If <span className="text-zinc-300 font-medium">{name}</span> goes down,
                  these <span className="text-zinc-300 font-medium">{data.affectedBy.length}</span> service{data.affectedBy.length !== 1 ? 's' : ''} are impacted:
                </p>
              )}
              {Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([hop, nodes]) => {
                  const style = HOP_STYLE[Number(hop)] || HOP_STYLE[4];
                  return (
                    <div key={hop}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {style.label}
                        </span>
                        <span className="text-[10px] text-zinc-600">{nodes.length} service{nodes.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {nodes.map(node => (
                          <button
                            key={node.name}
                            onClick={() => onSelectService(node.name)}
                            className="text-left p-2.5 rounded-lg transition-all hover:scale-[1.02]"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: ENV_DOT[node.environment] || '#71717a' }}
                              />
                              <span className="text-xs font-medium text-zinc-200 truncate">{node.name}</span>
                            </div>
                            {node.team !== 'unknown' && (
                              <span className="text-[10px] text-zinc-500">{node.team}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {data.affectedBy.length === 0 && data.dependsOn.length === 0 && (
        <p className="text-zinc-500 text-sm">No dependency data found for this service.</p>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}

function TabBtn({ label, active, onClick, danger }: { label: string; active: boolean; onClick: () => void; danger?: boolean }) {
  const activeColor = danger ? '#f87171' : '#22d3ee';
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-xs font-medium transition-all relative"
      style={{ color: active ? activeColor : '#71717a' }}
    >
      {label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: activeColor }} />}
    </button>
  );
}