'use client';

import { useEffect, useState } from 'react';

interface LabelCheck {
  key: string;
  value: string | null;
  present: boolean;
  required: boolean;
  description: string;
}

interface LabelData {
  compliant: boolean;
  complianceRate: number;
  checks: LabelCheck[];
  allLabels: Record<string, string>;
}

export default function LabelCompliancePanel({ name }: { name: string }) {
  const [data, setData]       = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labels/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  if (loading) return (
    <div className="glass-panel p-5 flex items-center justify-center h-24">
      <span className="text-zinc-500 text-sm">Checking labels…</span>
    </div>
  );
  if (!data) return null;

  const rateColor = data.complianceRate === 100 ? '#4ade80'
    : data.complianceRate >= 66 ? '#fbbf24' : '#f87171';
  const rateBg = data.complianceRate === 100 ? 'rgba(74,222,128,0.18)'
    : data.complianceRate >= 66 ? 'rgba(251,191,36,0.18)' : 'rgba(239,68,68,0.18)';
  const gradeLabel = data.complianceRate === 100 ? 'A'
    : data.complianceRate >= 80 ? 'B'
    : data.complianceRate >= 60 ? 'C' : 'D';

  const required    = data.checks.filter(c => c.required);
  const recommended = data.checks.filter(c => !c.required);

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Label Compliance</h3>
        <span
          className="text-sm px-3 py-1 rounded-full font-black"
          style={{ background: rateBg, color: rateColor }}
        >
          {data.complianceRate}% — {gradeLabel}
        </span>
      </div>

      {/* Required labels grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {required.map(c => <LabelCard key={c.key} check={c} />)}
      </div>

      {/* Recommended labels grid */}
      {recommended.some(c => c.present) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {recommended.filter(c => c.present).map(c => <LabelCard key={c.key} check={c} />)}
        </div>
      )}

      {/* Missing recommended as single line warnings */}
      {recommended.filter(c => !c.present).map(c => (
        <div key={c.key} className="flex items-center gap-2 mt-1">
          <span className="text-amber-400 text-xs">●</span>
          <span className="text-xs text-zinc-500">
            Recommended label missing: <span className="font-mono text-zinc-400">{c.key}</span> — {c.description}
          </span>
        </div>
      ))}
    </div>
  );
}

function LabelCard({ check }: { check: LabelCheck }) {
  const present = check.present;
  return (
    <div
      className="px-3 py-2.5 rounded-lg"
      style={{
        background: present ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${present ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)'}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] font-mono text-zinc-500 truncate flex-1">{check.key}</span>
        <span style={{ color: present ? '#4ade80' : '#f87171' }} className="text-xs shrink-0">
          {present ? '✓' : '✗'}
        </span>
      </div>
      {present && check.value ? (
        <span className="text-sm font-bold text-zinc-100 truncate block">{check.value}</span>
      ) : (
        <span className="text-[10px] text-zinc-600 leading-tight block">{check.description}</span>
      )}
    </div>
  );
}