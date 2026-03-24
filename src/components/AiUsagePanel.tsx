'use client';

import { useEffect, useState } from 'react';

interface ServiceUsage {
  service: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  lastUsed: string;
  costUsd: number;
}

interface UsageData {
  summary: {
    totalInput: number;
    totalOutput: number;
    totalCost: number;
    totalCalls: number;
    services: number;
  };
  services: ServiceUsage[];
}

interface AiUsagePanelProps {
  onSelectService?: (name: string) => void;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function AiUsagePanel({ onSelectService }: AiUsagePanelProps) {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai-usage')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    // Refresh every 30s
    const interval = setInterval(() => {
      fetch('/api/ai-usage')
        .then(r => r.json())
        .then(d => setData(d))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="glass-panel p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/3" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-zinc-800/50 rounded" />)}
    </div>
  );

  const isEmpty = !data || data.services.length === 0;

  return (
    <div className="glass-panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">AI Usage</h3>
          <p className="text-xs text-zinc-600 mt-0.5">Claude API token consumption per service</p>
        </div>
        {data && data.summary.services > 0 && (
          <div className="text-right">
            <div className="text-lg font-black text-zinc-100">${data.summary.totalCost.toFixed(4)}</div>
            <div className="text-xs text-zinc-500">{data.summary.totalCalls} analyses · {data.summary.services} services</div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="py-6 text-center space-y-2">
          <div className="text-zinc-600 text-sm">No AI analyses run yet</div>
          <div className="text-zinc-700 text-xs">Click any service and run an AI analysis to see token usage here</div>
          <div className="text-xs px-3 py-2 rounded-lg inline-block"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa' }}>
            Enterprise teams can track which services consume the most AI budget
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Input tokens', value: fmt(data.summary.totalInput), color: '#22d3ee' },
              { label: 'Output tokens', value: fmt(data.summary.totalOutput), color: '#a78bfa' },
              { label: 'Total cost', value: `$${data.summary.totalCost.toFixed(4)}`, color: '#4ade80' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-2.5 rounded-lg text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-sm font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Per-service breakdown */}
          <div className="space-y-1.5">
            {data.services.map((svc, i) => {
              const maxCost = data.services[0]?.costUsd ?? 1;
              const barWidth = maxCost > 0 ? (svc.costUsd / maxCost) * 100 : 0;
              const inputPct = (svc.inputTokens + svc.outputTokens) > 0
                ? (svc.inputTokens / (svc.inputTokens + svc.outputTokens)) * 100 : 50;

              return (
                <button key={svc.service} onClick={() => onSelectService?.(svc.service)}
                  className="w-full text-left group rounded-lg p-2 transition-all"
                  style={{ border: '1px solid transparent' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                      <span className="text-sm font-mono text-zinc-200 group-hover:text-violet-400 transition-colors">
                        {svc.service}
                      </span>
                      <span className="text-xs text-zinc-600">{svc.calls}x</span>
                    </div>
                    <span className="text-sm font-bold text-zinc-200">${svc.costUsd.toFixed(4)}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/50">
                    <div className="h-full rounded-l-full" style={{ width: `${barWidth * inputPct / 100}%`, background: '#22d3ee' }} />
                    <div className="h-full rounded-r-full" style={{ width: `${barWidth * (100 - inputPct) / 100}%`, background: '#a78bfa' }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-zinc-600">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" />
                      in {fmt(svc.inputTokens)}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1" />
                      out {fmt(svc.outputTokens)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-zinc-700 border-t border-white/5 pt-2">
            Pricing: $3/1M input · $15/1M output (Claude Sonnet) · resets on server restart
          </p>
        </>
      )}
    </div>
  );
}