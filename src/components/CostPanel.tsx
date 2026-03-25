'use client';

// TODO(cost): Add Anthropic API cost tracking per team
// - Pull usage from Anthropic's usage API (https://docs.anthropic.com/en/api/usage)
// - Cross-reference with owner_team label already on each deployment node
// - Show per-team AI spend (Claude tokens) alongside K8s infrastructure cost
// - Add "AI Costs" tab next to the existing Prometheus CPU/memory cost breakdown
// - Useful for enterprise setups where each team has their own API key or cost center

import { useEffect, useState } from 'react';
import SlotMachine from './SlotMachine';

interface MetricsData {
  prometheusAvailable: boolean;
  namespaceCount: number;
  namespaces: Array<{
    namespace: string;
    replicas: number;
    requested: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
    actualAvg: { cpu: string | null; memory: string | null };
    actualP95: { cpu: string | null; memory: string | null };
    utilization: { cpu: number | null; memory: number | null };
    cost: {
      requestedMonthly: string;
      actualMonthly: string | null;
      potentialSavings: string | null;
    };
  }>;
  replicas: number;
  requested: { cpu: string; memory: string };
  limits: { cpu: string; memory: string };
  actualAvg: { cpu: string | null; memory: string | null };
  actualP95: { cpu: string | null; memory: string | null };
  utilization: { cpu: number | null; memory: number | null };
  cost: {
    requestedMonthly: string;
    actualMonthly: string | null;
    potentialSavings: string | null;
  };
  databases?: Array<{
    name: string;
    type: string;
    avgCpu: string | null;
    avgMem: string | null;
    monthlyCost: string | null;
  }>;
  totalPotentialSavings?: string | null;
  infraCostMonthly?: string | null;
  totalCostWithInfra?: string | null;
  loadBalancers?: Array<{ name: string; costMonthly: string }>;
  pvcs?: Array<{ name: string; storage: string; storageClass: string; costMonthly: string }>;
  lbCostMonthly?: string | null;
  pvcCostMonthly?: string | null;
}

interface CostPanelProps {
  name: string;
}

export default function CostPanel({ name }: CostPanelProps) {
  const [state, setState] = useState<{
    name: string;
    data: MetricsData | null;
    loading: boolean;
  }>({
    name,
    data: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/metrics/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setState({ name, data, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ name, data: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  const loading = state.loading || state.name !== name;
  const data = state.name === name ? state.data : null;

  if (loading) {
    return (
      <div className="glass-panel p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-32 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-zinc-800 rounded w-full" />
          <div className="h-3 bg-zinc-800 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!data || !data.requested) return null;

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-medium text-zinc-400">Resource Costs</h3>
          <p className="text-xs text-zinc-600 mt-0.5">
            {data.namespaceCount} namespace{data.namespaceCount === 1 ? '' : 's'} • {data.replicas} total replicas
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {data.namespaceCount > 1 && (
            <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Aggregated across namespaces
            </span>
          )}
          {!data.prometheusAvailable && (
            <span className="text-amber-400">Prometheus unavailable</span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-3 mb-4">
          <SummaryCard label="Service" value={data.cost.requestedMonthly} />
          <SummaryCard label="Actual" value={data.cost.actualMonthly || '-'} muted={!data.cost.actualMonthly} />
          <SummaryCard label="Savings" value={data.totalPotentialSavings || data.cost.potentialSavings || '-'} accent={(data.totalPotentialSavings || data.cost.potentialSavings) ? 'green' : undefined} muted={!data.totalPotentialSavings && !data.cost.potentialSavings} />
          <SummaryCard label="Infra" value={data.infraCostMonthly || '-'} accent="cyan" muted={!data.infraCostMonthly} />
          {data.lbCostMonthly && <SummaryCard label="LB" value={data.lbCostMonthly} accent="purple" />}
          {data.pvcCostMonthly && <SummaryCard label="Storage" value={data.pvcCostMonthly} accent="orange" />}
          <SummaryCard label="Total" value={data.totalCostWithInfra || '-'} accent="red" muted={!data.totalCostWithInfra} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-1.5 font-medium">Resource</th>
              <th className="text-right py-1.5 font-medium">Requested total</th>
              <th className="text-right py-1.5 font-medium">Limit total</th>
              {data.prometheusAvailable && (
                <>
                  <th className="text-right py-1.5 font-medium">Actual total (avg)</th>
                  <th className="text-right py-1.5 font-medium">Actual total (P95)</th>
                  <th className="text-right py-1.5 font-medium">Util %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2 text-zinc-300">CPU</td>
              <td className="py-2 text-right font-mono text-zinc-200">{data.requested.cpu}</td>
              <td className="py-2 text-right font-mono text-zinc-200">
                <span className={data.limits.cpu === 'not set' ? 'text-amber-400' : ''}>
                  {data.limits.cpu}
                </span>
              </td>
              {data.prometheusAvailable && (
                <>
                  <td className="py-2 text-right font-mono text-zinc-300">{data.actualAvg.cpu || '-'}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{data.actualP95.cpu || '-'}</td>
                  <td className="py-2 text-right">
                    {data.utilization.cpu !== null ? <UtilBadge pct={data.utilization.cpu} /> : '-'}
                  </td>
                </>
              )}
            </tr>
            <tr>
              <td className="py-2 text-zinc-300">Memory</td>
              <td className="py-2 text-right font-mono text-zinc-200">{data.requested.memory}</td>
              <td className="py-2 text-right font-mono text-zinc-200">
                <span className={data.limits.memory === 'not set' ? 'text-amber-400' : ''}>
                  {data.limits.memory}
                </span>
              </td>
              {data.prometheusAvailable && (
                <>
                  <td className="py-2 text-right font-mono text-zinc-300">{data.actualAvg.memory || '-'}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{data.actualP95.memory || '-'}</td>
                  <td className="py-2 text-right">
                    {data.utilization.memory !== null ? <UtilBadge pct={data.utilization.memory} /> : '-'}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        {data.namespaces.length >= 1 && data.prometheusAvailable && (
          <div className="mt-6 mb-6">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">Resource Distribution (Actual Avg)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <DonutChart 
                title="CPU" 
                data={data.namespaces.map(n => ({ label: n.namespace, value: parseResource(n.actualAvg.cpu) }))} 
              />
              <DonutChart 
                title="MEM" 
                data={data.namespaces.map(n => ({ label: n.namespace, value: parseResource(n.actualAvg.memory) }))} 
              />
            </div>
          </div>
        )}

        {data.databases && data.databases.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Infrastructure Costs</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.databases.map(db => (
                <div key={db.name} className="glass-panel px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cyan-400 font-mono text-sm font-bold">{db.name}</span>
                    {db.type === 'infra' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">shared</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-400">
                    <span>CPU: <span className="text-zinc-200">{db.avgCpu || '—'}</span></span>
                    <span>Mem: <span className="text-zinc-200">{db.avgMem || '—'}</span></span>
                  </div>
                  {db.monthlyCost && (
                    <div className="mt-1 text-xs">
                      <span className="text-zinc-500">Monthly: </span>
                      <span className="text-amber-400 font-mono font-bold"><SlotMachine value={db.monthlyCost} /></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LoadBalancers */}
        {data.loadBalancers && data.loadBalancers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Load Balancers</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.loadBalancers.map(lb => (
                <div key={lb.name} className="glass-panel px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400 font-mono text-sm font-bold">{lb.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">LoadBalancer</span>
                  </div>
                  <div className="mt-1 text-xs">
                    <span className="text-zinc-500">Monthly: </span>
                    <span className="text-purple-300 font-mono font-bold"><SlotMachine value={lb.costMonthly} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PersistentVolumeClaims */}
        {data.pvcs && data.pvcs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Storage (PVCs)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.pvcs.map(pvc => (
                <div key={pvc.name} className="glass-panel px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-orange-400 font-mono text-sm font-bold">{pvc.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">{pvc.storageClass}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-400">
                    <span>Size: <span className="text-zinc-200">{pvc.storage}</span></span>
                  </div>
                  <div className="mt-1 text-xs">
                    <span className="text-zinc-500">Monthly: </span>
                    <span className="text-orange-300 font-mono font-bold"><SlotMachine value={pvc.costMonthly} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Per-namespace breakdown</h4>
            <span className="text-[11px] text-zinc-600">
              Requests/limits are estimated as per-replica manifest values × observed replicas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 font-medium">Namespace</th>
                  <th className="text-right py-2 font-medium">Replicas</th>
                  <th className="text-right py-2 font-medium">CPU req</th>
                  <th className="text-right py-2 font-medium">Mem req</th>
                  <th className="text-right py-2 font-medium">CPU avg</th>
                  <th className="text-right py-2 font-medium">Mem avg</th>
                  <th className="text-right py-2 font-medium">CPU P95</th>
                  <th className="text-right py-2 font-medium">Mem P95</th>
                  <th className="text-right py-2 font-medium">Requested / mo</th>
                  <th className="text-right py-2 font-medium">Actual / mo</th>
                  <th className="text-right py-2 font-medium">Savings</th>
                </tr>
              </thead>
              <tbody>
                {data.namespaces.map(row => (
                  <tr key={row.namespace} className="border-b border-zinc-800/40 last:border-b-0">
                    <td className="py-2 text-zinc-200 font-mono">{row.namespace}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.replicas}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.requested.cpu}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.requested.memory}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.actualAvg.cpu || '-'}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.actualAvg.memory || '-'}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.actualP95.cpu || '-'}</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{row.actualP95.memory || '-'}</td>
                    <td className="py-2 text-right font-mono text-zinc-200">
                      <SlotMachine value={row.cost.requestedMonthly} />
                    </td>
                    <td className="py-2 text-right font-mono text-zinc-300">
                      <SlotMachine value={row.cost.actualMonthly || '-'} />
                    </td>
                    <td className="py-2 text-right font-mono">
                      <span className={row.cost.potentialSavings ? 'text-green-400' : 'text-zinc-500'}>
                        <SlotMachine value={row.cost.potentialSavings || '-'} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = 35;
  const centerX = 50;
  const centerY = 50;
  const strokeWidth = 12;

  // Pre-compute start angles to avoid mutation inside render
  const startAngles = data.reduce<number[]>((acc) => {
    const prev = acc[acc.length - 1] ?? 0;
    const prevAngle = data[acc.length - 1] ? (data[acc.length - 1].value / total) * 360 : 0;
    return [...acc, prev + (acc.length === 0 ? 0 : prevAngle)];
  }, []);
  const COLORS = [
    '#22d3ee', // cyan-400
    '#818cf8', // indigo-400
    '#c084fc', // purple-400
    '#f472b6', // pink-400
    '#fbbf24', // amber-400
    '#34d399', // emerald-400
    '#f87171', // red-400
    '#a78bfa', // violet-400
  ];

  return (
    <div className="flex items-center gap-10">
      <div className="relative w-44 h-44 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {data.map((d, i) => {
            const angle = (d.value / total) * 360;
            const startAngle = startAngles[i];
            const endAngle = startAngle + angle;

            if (angle < 0.5) return null;

            // Full circle: use circle element instead of arc
            if (angle >= 359.5) {
              return (
                <circle
                  key={d.label}
                  cx={centerX}
                  cy={centerY}
                  r={radius}
                  fill="transparent"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={strokeWidth}
                  className="transition-all duration-500"
                />
              );
            }

            const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
            const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
            const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
            const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

            const largeArcFlag = angle > 180 ? 1 : 0;
            const dPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

            return (
              <path
                key={d.label}
                d={dPath}
                fill="transparent"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={strokeWidth}
                className="transition-all duration-500 hover:opacity-80 cursor-pointer"
                style={{ strokeLinecap: 'butt' }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-base font-bold uppercase tracking-wider text-zinc-100">{title}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: COLORS[i % COLORS.length] }} 
              />
              <span className="text-zinc-400 truncate font-mono">{d.label}</span>
            </div>
            <span className="text-zinc-500 ml-2 flex-shrink-0 font-mono">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseResource(value: string | null): number {
  if (!value || value === 'not set' || value === '-' || value === '0') return 0;
  const num = parseFloat(value);
  const unit = value.replace(/[0-9.]/g, '').toLowerCase();
  
  if (unit === 'm') return num / 1000;
  if (unit === 'gi') return num * 1024;
  if (unit === 'ki') return num / 1024;
  return num;
}

function SummaryCard({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'cyan' | 'red' | 'purple' | 'orange';
  muted?: boolean;
}) {
  const valueColor = muted
    ? 'text-zinc-500'
    : accent === 'green'
      ? 'text-green-400'
      : accent === 'red'
        ? 'text-red-400'
        : accent === 'cyan'
          ? 'text-cyan-400'
          : accent === 'purple'
            ? 'text-purple-400'
            : accent === 'orange'
              ? 'text-orange-400'
              : 'text-zinc-100';

  return (
    <div className="glass-panel px-4 py-3 flex-1 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className={`font-mono text-xl font-black truncate ${valueColor}`}>
        <SlotMachine value={value} />
      </div>
    </div>
  );
}

function UtilBadge({ pct }: { pct: number }) {
  const color = pct > 50 ? 'text-green-400' : pct > 20 ? 'text-amber-400' : 'text-red-400';
  return <span className={`font-mono ${color}`}>{pct}%</span>;
}