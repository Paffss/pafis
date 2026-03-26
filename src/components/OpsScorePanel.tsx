'use client';

import { useEffect, useState } from 'react';

interface OpsCheck {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
  category: 'reliability' | 'observability' | 'delivery' | 'security';
}

interface OpsScoreData {
  score: number;
  maxScore: number;
  grade: string;
  checks: OpsCheck[];
}

const GRADE_COLOR: Record<string, string> = {
  A: '#4ade80', B: '#22d3ee', C: '#fbbf24', D: '#f97316', F: '#ef4444',
};

const GRADE_BG: Record<string, string> = {
  A: 'rgba(74,222,128,0.2)',  B: 'rgba(34,211,238,0.2)',
  C: 'rgba(251,191,36,0.2)',  D: 'rgba(249,115,22,0.2)', F: 'rgba(239,68,68,0.2)',
};

const CATEGORY_COLOR: Record<string, string> = {
  reliability:   '#22d3ee',
  observability: '#a78bfa',
  delivery:      '#34d399',
  security:      '#f87171',
};

const CATEGORY_LABEL: Record<string, string> = {
  reliability:   'Reliability',
  observability: 'Observability',
  delivery:      'Delivery',
  security:      'Security',
};

export default function OpsScorePanel({ name }: { name: string }) {
  const [data, setData]       = useState<OpsScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ops-score/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  if (loading) return (
    <div className="glass-panel p-5 flex items-center justify-center" style={{ minHeight: '200px' }}>
      <span className="text-zinc-500 text-sm">Calculating…</span>
    </div>
  );
  if (!data) return null;

  const pct        = Math.round((data.score / data.maxScore) * 100);
  const gradeColor = GRADE_COLOR[data.grade] || '#71717a';
  const gradeBg    = GRADE_BG[data.grade]    || 'rgba(113,113,122,0.2)';

  // SVG gauge
  const R = 52, CIRCUM = 2 * Math.PI * R;
  const strokeDash = (pct / 100) * CIRCUM;

  // Group by category
  const byCategory = data.checks.reduce<Record<string, OpsCheck[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="glass-panel p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">OPS Score</h3>
        <span
          className="text-sm px-3 py-1 rounded-full font-black"
          style={{ background: gradeBg, color: gradeColor }}
        >
          Grade {data.grade}
        </span>
      </div>

      <div className="flex gap-5 items-start">
        {/* Circular gauge */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none"
                stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <circle cx="60" cy="60" r={R} fill="none"
                stroke={gradeColor} strokeWidth="10"
                strokeDasharray={`${strokeDash} ${CIRCUM}`}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dasharray 1s ease',
                  filter: `drop-shadow(0 0 8px ${gradeColor}80)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black tabular-nums" style={{ color: gradeColor }}>{data.score}</span>
              <span className="text-[10px] text-zinc-500 font-mono">/ {data.maxScore}</span>
            </div>
          </div>
        </div>

        {/* 2-column checklist */}
        <div className="flex-1 space-y-3 min-w-0">
          {Object.entries(byCategory).map(([cat, checks]) => (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: CATEGORY_COLOR[cat] }}>
                  {CATEGORY_LABEL[cat]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {checks.map(check => (
                  <div key={check.id} className="flex items-start gap-1.5 min-w-0">
                    <span className="text-xs shrink-0 mt-px" style={{ color: check.passed ? '#4ade80' : '#f87171' }}>
                      {check.passed ? '✓' : '✗'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-300 truncate">{check.label}</span>
                        <span className="text-[9px] font-mono text-zinc-600 shrink-0 ml-auto">
                          {check.points}/{check.maxPoints}
                        </span>
                      </div>
                      {!check.passed && (
                        <p className="text-[9px] text-zinc-500 leading-tight mt-0.5 line-clamp-2">{check.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}