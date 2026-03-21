'use client';

import { useEffect, useState } from 'react';
import RiskSummary from './RiskSummary';
import UnusedResources from './UnusedResources';

interface Stats {
  totalNodes: number;
  deployments: number;
  services: number;
  ingresses: number;
  helmCharts: number;
  configmaps: number;
  secrets: number;
  databases: number;
  serviceMonitors: number;
  networkPolicies: number;
  edges: number;
  teamDistribution: Record<string, number>;
  noLimits: number;
  singleReplica: number;
  latestTag: number;
  noLivenessProbe: number;
  environments: number;
}

interface DashboardProps {
  onSelectService?: (name: string) => void;
}

export default function Dashboard({ onSelectService }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'unused'>('overview');

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => null);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 animate-pulse text-zinc-500">
        Loading infrastructure data...
      </div>
    );
  }

  const teamEntries = Object.entries(stats.teamDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Hero stats */}
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-bold text-zinc-100">{stats.deployments} Deployments</h2>
        <p className="text-zinc-500 text-sm">
          {stats.services} services · {stats.helmCharts} helm charts · {stats.databases} databases · {stats.networkPolicies} network rules
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Nodes" value={stats.totalNodes} />
        <StatCard label="Graph Edges" value={stats.edges} />
        <StatCard label="ConfigMaps" value={stats.configmaps} />
        <StatCard label="Secrets" value={stats.secrets} />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-white/5">
        {(['overview', 'risks', 'unused'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-xs font-medium capitalize transition-all relative"
            style={{ color: activeTab === tab ? '#22d3ee' : '#71717a' }}
          >
            {tab === 'risks' && stats.noLimits + stats.noLivenessProbe > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
            )}
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-cyan-400" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          {/* Risk overview */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Risk Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RiskStat label="No Resource Limits"   value={stats.noLimits}        total={stats.deployments} severity="critical" />
              <RiskStat label="Single Replica (SPOF)" value={stats.singleReplica}   total={stats.deployments} severity="warning" />
              <RiskStat label="Using :latest tag"     value={stats.latestTag}        total={stats.deployments} severity="critical" />
              <RiskStat label="No Liveness Probe"    value={stats.noLivenessProbe} total={stats.deployments} severity="warning" />
            </div>
          </div>

          {/* Team distribution */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Deployments by Team ({teamEntries.length} teams)
            </h3>
            <TeamDonut data={teamEntries} total={stats.deployments} />
          </div>
        </div>
      ) : activeTab === 'risks' ? (
        <RiskSummary onSelectService={name => onSelectService?.(name)} />
      ) : (
        <UnusedResources />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel p-3 text-center">
      <div className="text-2xl font-bold text-zinc-100">{value.toLocaleString()}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function RiskStat({ label, value, total, severity }: {
  label: string; value: number; total: number; severity: 'critical' | 'warning';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color = severity === 'critical' ? 'text-red-400' : 'text-amber-400';
  const bg    = severity === 'critical' ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)';
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: bg }}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
      <div className="text-xs text-zinc-600">{pct}% of services</div>
    </div>
  );
}

const TEAM_COLORS = [
  '#22d3ee','#3b82f6','#8b5cf6','#14b8a6','#f59e0b',
  '#ec4899','#10b981','#f97316','#6366f1','#06b6d4',
  '#a855f7','#ef4444','#84cc16','#e879f9',
];

function TeamDonut({ data, total }: { data: [string, number][]; total: number }) {
  const radius = 80, cx = 100, cy = 100, strokeWidth = 28;

  // Pre-compute start angles to avoid mutation inside render
  const startAngles = data.reduce<number[]>((acc, _, i) => {
    if (i === 0) return [0];
    const prevAngle = (data[i - 1][1] / total) * 360;
    return [...acc, acc[i - 1] + prevAngle];
  }, []);

  return (
    <div className="flex items-center gap-8 justify-center flex-wrap">
      <div className="relative w-[200px] h-[200px] shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={radius} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
          {data.map(([, count], i) => {
            const angle = (count / total) * 360;
            const start = startAngles[i];
            const end = start + angle;
            if (angle < 0.5) return null;
            if (angle >= 359.5) return (
              <circle key={i} cx={cx} cy={cy} r={radius} fill="transparent"
                stroke={TEAM_COLORS[i % TEAM_COLORS.length]} strokeWidth={strokeWidth} />
            );
            const x1 = cx + radius * Math.cos((start * Math.PI) / 180);
            const y1 = cy + radius * Math.sin((start * Math.PI) / 180);
            const x2 = cx + radius * Math.cos((end * Math.PI) / 180);
            const y2 = cy + radius * Math.sin((end * Math.PI) / 180);
            return (
              <path key={i}
                d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`}
                fill="transparent" stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                strokeWidth={strokeWidth} className="hover:opacity-80 transition-opacity" />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-black text-zinc-100">{total}</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">deploys</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {data.map(([team, count], i) => (
          <div key={team} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }} />
            <span className="text-zinc-400 truncate max-w-[140px]" title={team}>{team}</span>
            <span className="text-zinc-500 font-mono ml-auto">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}