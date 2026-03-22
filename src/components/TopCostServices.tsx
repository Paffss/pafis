'use client';

import { useEffect, useState } from 'react';

interface CostService {
  name: string;
  team: string;
  replicas: number;
  cpuRequest: string;
  memRequest: string;
  monthlyCost: number;
  cpuCost: number;
  memCost: number;
}

interface TopCostData {
  topServices: CostService[];
  totalMonthlyCost: number;
  serviceCount: number;
}

interface TopCostServicesProps {
  onSelectService: (name: string) => void;
}

export default function TopCostServices({ onSelectService }: TopCostServicesProps) {
  const [data, setData]     = useState<TopCostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/topcost')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="glass-panel p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/3" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-zinc-800/50 rounded" />)}
    </div>
  );

  if (!data) return null;

  const maxCost = data.topServices[0]?.monthlyCost ?? 1;

  return (
    <div className="glass-panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Top Cost Services</h3>
        <div className="text-right">
          <div className="text-lg font-black text-zinc-100">${data.totalMonthlyCost.toFixed(2)}</div>
          <div className="text-xs text-zinc-500">est. monthly · {data.serviceCount} services</div>
        </div>
      </div>

      {/* Services list */}
      <div className="space-y-2">
        {data.topServices.map((svc, i) => {
          const barWidth = (svc.monthlyCost / maxCost) * 100;
          const cpuPct   = svc.monthlyCost > 0 ? (svc.cpuCost / svc.monthlyCost) * 100 : 0;
          return (
            <button key={svc.name} onClick={() => onSelectService(svc.name)}
              className="w-full text-left group transition-all rounded-lg p-2 hover:bg-white/3"
              style={{ border: '1px solid transparent' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(34,211,238,0.1)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                  <span className="text-sm font-mono text-zinc-200 group-hover:text-cyan-400 transition-colors">
                    {svc.name}
                  </span>
                  <span className="text-xs text-zinc-600">{svc.replicas}r</span>
                  {svc.team !== 'unknown' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{svc.team}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-zinc-200">${svc.monthlyCost.toFixed(2)}</span>
              </div>
              {/* Cost bar — split CPU vs memory */}
              <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/50" style={{ width: '100%' }}>
                <div className="h-full rounded-l-full transition-all"
                  style={{ width: `${barWidth * cpuPct / 100}%`, background: '#22d3ee' }} />
                <div className="h-full rounded-r-full transition-all"
                  style={{ width: `${barWidth * (100 - cpuPct) / 100}%`, background: '#8b5cf6' }} />
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px] text-zinc-600">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" />
                  CPU ${svc.cpuCost.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-600">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1" />
                  Mem ${svc.memCost.toFixed(2)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-700 border-t border-white/5 pt-2">
        Estimated using AWS EKS on-demand pricing · click any service to inspect
      </p>
    </div>
  );
}