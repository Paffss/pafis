'use client';

import { useEffect, useState } from 'react';
import RiskSummary from './RiskSummary';
import UnusedResources from './UnusedResources';
import TeamPanel from './TeamPanel';
import TopCostServices from './TopCostServices';
import AiCostsDashboard from './AiCostsDashboard';

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
  noOwnerTeam: number;
  environments: number;
  environmentDistribution: Record<string, number>;
  pvcs: number;
  loadBalancers: number;
  pvcCostMonthly: number;
  lbCostMonthly: number;
}

interface Deployment {
  name: string;
  team: string;
  environment: string;
  replicas: number;
  image: string;
  noLimits: boolean;
  latestTag: boolean;
  singleReplica: boolean;
  noLivenessProbe: boolean;
  noOwnerTeam: boolean;
}

type FilterType = 'env' | 'noLimits' | 'latestTag' | 'singleReplica' | 'noLivenessProbe' | 'noOwnerTeam';

interface ActiveFilter {
  type: FilterType;
  value: string; // env name for env filter, ignored for risk filters
  label: string;
}

interface DashboardProps {
  onSelectService?: (name: string) => void;
}

export default function Dashboard({ onSelectService }: DashboardProps) {
  const [stats, setStats]               = useState<Stats | null>(null);
  const [deployments, setDeployments]   = useState<Deployment[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [activeTab, setActiveTab]       = useState<'overview' | 'risks' | 'unused' | 'ai-costs'>('overview');
  const [selectedTeam, setSelectedTeam] = useState<{ name: string; color: string } | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => null);
    fetch('/api/deployments').then(r => r.json()).then(setDeployments).catch(() => []);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Loading infrastructure data...
      </div>
    );
  }

  const teamEntries = Object.entries(stats.teamDistribution).sort((a, b) => b[1] - a[1]);
  const totalRisks  = stats.noLimits + stats.noLivenessProbe;

  // Apply active filter to deployments
  const filteredDeployments = activeFilter ? deployments.filter(d => {
    if (activeFilter.type === 'env')            return d.environment === activeFilter.value;
    if (activeFilter.type === 'noLimits')       return d.noLimits;
    if (activeFilter.type === 'latestTag')      return d.latestTag;
    if (activeFilter.type === 'singleReplica')  return d.singleReplica;
    if (activeFilter.type === 'noLivenessProbe') return d.noLivenessProbe;
    if (activeFilter.type === 'noOwnerTeam')    return d.noOwnerTeam;
    return false;
  }) : [];

  const toggleFilter = (filter: ActiveFilter) => {
    setActiveFilter(prev =>
      prev?.type === filter.type && prev?.value === filter.value ? null : filter
    );
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="glass-panel p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-4xl font-black text-zinc-100 tracking-tight">
              {stats.deployments}
              <span className="text-xl font-normal text-zinc-500 ml-2">deployments</span>
            </h2>
            <p className="text-zinc-400 mt-1">
              {stats.services} services · {stats.helmCharts} helm charts · {stats.databases} databases · {stats.networkPolicies} network rules
              {stats.loadBalancers > 0 && ` · ${stats.loadBalancers} load balancers`}
              {stats.pvcs > 0 && ` · ${stats.pvcs} PVCs`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalRisks > 0 && (
              <button
                onClick={() => setActiveTab('risks')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span className="text-red-400 text-2xl font-bold">{totalRisks}</span>
                <span className="text-red-400/70 text-sm">critical issues →</span>
              </button>
            )}
            <a
              href="/report" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
            >
              ↓ Export PDF
            </a>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5">
          <MiniStat label="Graph Nodes" value={stats.totalNodes} />
          <MiniStat label="Graph Edges" value={stats.edges} />
          <MiniStat label="ConfigMaps"  value={stats.configmaps} />
          <MiniStat label="Secrets"     value={stats.secrets} />
          {stats.loadBalancers > 0 && (
            <MiniStatText label="LB Cost/mo"      value={`$${stats.lbCostMonthly.toFixed(0)}/mo`} />
          )}
          {stats.pvcs > 0 && (
            <MiniStatText label="Storage Cost/mo" value={`$${stats.pvcCostMonthly.toFixed(2)}/mo`} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {(['overview', 'risks', 'unused', 'ai-costs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 text-sm font-medium capitalize transition-all relative"
            style={{ color: activeTab === tab ? '#22d3ee' : '#71717a' }}
          >
            {tab === 'risks' && totalRisks > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-400" />
            )}
            {tab === 'ai-costs' ? 'AI & Costs' : tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-5">

          {/* Production Readiness — clickable risk cards */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Production Readiness</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <RiskCard
                label="No Resource Limits"  value={stats.noLimits}        total={stats.deployments} severity="critical"
                active={activeFilter?.type === 'noLimits'}
                onClick={() => toggleFilter({ type: 'noLimits', value: '', label: 'No Resource Limits' })}
              />
              <RiskCard
                label="Single Replica"       value={stats.singleReplica}   total={stats.deployments} severity="warning"
                active={activeFilter?.type === 'singleReplica'}
                onClick={() => toggleFilter({ type: 'singleReplica', value: '', label: 'Single Replica' })}
              />
              <RiskCard
                label="Using :latest tag"    value={stats.latestTag}        total={stats.deployments} severity="critical"
                active={activeFilter?.type === 'latestTag'}
                onClick={() => toggleFilter({ type: 'latestTag', value: '', label: 'Using :latest tag' })}
              />
              <RiskCard
                label="No Liveness Probe"   value={stats.noLivenessProbe} total={stats.deployments} severity="warning"
                active={activeFilter?.type === 'noLivenessProbe'}
                onClick={() => toggleFilter({ type: 'noLivenessProbe', value: '', label: 'No Liveness Probe' })}
              />
              <RiskCard
                label="No Owner Team"        value={stats.noOwnerTeam || 0} total={stats.deployments} severity="warning"
                active={activeFilter?.type === 'noOwnerTeam'}
                onClick={() => toggleFilter({ type: 'noOwnerTeam', value: '', label: 'No Owner Team' })}
              />
            </div>
          </div>

          {/* Environment distribution — clickable */}
          <EnvironmentPanel
            distribution={stats.environmentDistribution}
            selected={activeFilter?.type === 'env' ? activeFilter.value : null}
            onSelect={env => toggleFilter({ type: 'env', value: env, label: `${env} services` })}
          />

          {/* Filtered service list drawer */}
          {activeFilter && (
            <ServiceListDrawer
              filter={activeFilter}
              deployments={filteredDeployments}
              onSelectService={name => onSelectService?.(name)}
              onClose={() => setActiveFilter(null)}
            />
          )}

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="glass-panel p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                Team Ownership ({teamEntries.length} teams)
              </h3>
              <TeamDonut
                data={teamEntries}
                total={stats.deployments}
                onSelectTeam={(name, color) => setSelectedTeam(prev =>
                  prev?.name === name ? null : { name, color }
                )}
                selectedTeam={selectedTeam?.name}
              />
              {selectedTeam && (
                <TeamPanel
                  team={selectedTeam.name}
                  color={selectedTeam.color}
                  onSelectService={name => onSelectService?.(name)}
                  onClose={() => setSelectedTeam(null)}
                  inline
                />
              )}
            </div>
            <div className="lg:col-span-2">
              <TopCostServices onSelectService={name => onSelectService?.(name)} />
            </div>
          </div>
        </div>
      ) : activeTab === 'risks' ? (
        <RiskSummary onSelectService={name => onSelectService?.(name)} />
      ) : activeTab === 'ai-costs' ? (
        <AiCostsDashboard onSelectService={name => onSelectService?.(name)} />
      ) : (
        <UnusedResources />
      )}
    </div>
  );
}

// ── ServiceListDrawer ──────────────────────────────────────────────────────────
const ENV_DOT: Record<string, string> = {
  production: '#ef4444', staging: '#eab308', qa: '#f97316', dev: '#22c55e', unknown: '#71717a',
};

function ServiceListDrawer({ filter, deployments, onSelectService, onClose }: {
  filter: ActiveFilter;
  deployments: Deployment[];
  onSelectService: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="glass-panel p-5" style={{ border: '1px solid rgba(34,211,238,0.15)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-cyan-400">{filter.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {deployments.length} service{deployments.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
        >
          ✕ close
        </button>
      </div>

      {deployments.length === 0 ? (
        <p className="text-zinc-500 text-sm">No services match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {deployments.map(d => (
            <button
              key={d.name}
              onClick={() => onSelectService(d.name)}
              className="text-left p-3 rounded-lg transition-all hover:scale-[1.01]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: ENV_DOT[d.environment] || ENV_DOT.unknown }}
                />
                <span className="text-sm font-medium text-zinc-100 truncate">{d.name}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {d.team !== 'unknown' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{d.team}</span>
                )}
                {d.noLimits && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">no limits</span>
                )}
                {d.latestTag && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">:latest</span>
                )}
                {d.singleReplica && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">1 replica</span>
                )}
                {d.noLivenessProbe && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">no probe</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EnvironmentPanel ───────────────────────────────────────────────────────────
const ENV_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  production: { label: 'Production', bg: 'rgba(239,68,68,0.1)',  text: '#fca5a5', dot: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  staging:    { label: 'Staging',    bg: 'rgba(234,179,8,0.1)',  text: '#fde047', dot: '#eab308', border: 'rgba(234,179,8,0.25)' },
  qa:         { label: 'QA',         bg: 'rgba(249,115,22,0.1)', text: '#fdba74', dot: '#f97316', border: 'rgba(249,115,22,0.25)' },
  dev:        { label: 'Dev',        bg: 'rgba(34,197,94,0.1)',  text: '#86efac', dot: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  unknown:    { label: 'Unknown',    bg: 'rgba(113,113,122,0.1)',text: '#a1a1aa', dot: '#71717a', border: 'rgba(113,113,122,0.2)' },
};
const ENV_ORDER = ['production', 'staging', 'qa', 'dev', 'unknown'];

function EnvironmentPanel({ distribution, selected, onSelect }: {
  distribution: Record<string, number>;
  selected: string | null;
  onSelect: (env: string) => void;
}) {
  const entries = ENV_ORDER.filter(e => distribution[e] > 0);
  if (entries.length === 0) return null;
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="glass-panel p-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">
        Environments ({entries.length} detected) — <span className="text-zinc-600 font-normal normal-case tracking-normal">click to filter services</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {entries.map(env => {
          const cfg = ENV_CONFIG[env] || ENV_CONFIG.unknown;
          const count = distribution[env] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isSelected = selected === env;
          return (
            <button
              key={env}
              onClick={() => onSelect(env)}
              className="text-center p-4 rounded-lg transition-all"
              style={{
                background: isSelected ? cfg.bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                <span className="text-xs font-medium" style={{ color: cfg.text }}>{cfg.label}</span>
              </div>
              <div className="text-3xl font-black text-zinc-100">{count}</div>
              <div className="text-xs text-zinc-500 mt-1">{pct}% of services</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-2xl font-bold text-zinc-100">{value.toLocaleString()}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function MiniStatText({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-2xl font-bold text-amber-400">{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function RiskCard({ label, value, total, severity, active, onClick }: {
  label: string; value: number; total: number; severity: 'critical' | 'warning';
  active?: boolean; onClick?: () => void;
}) {
  const pct        = total > 0 ? Math.round((value / total) * 100) : 0;
  const isCritical = severity === 'critical';
  const color      = isCritical ? '#f87171' : '#fbbf24';
  const bg         = active
    ? (isCritical ? 'rgba(248,113,113,0.18)' : 'rgba(251,191,36,0.18)')
    : (isCritical ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)');
  const border     = isCritical ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)';

  return (
    <button
      onClick={onClick}
      className="text-center p-4 rounded-lg w-full transition-all"
      style={{
        background: bg,
        border: `1px solid ${active ? color : border}`,
        transform: active ? 'scale(1.02)' : 'scale(1)',
        cursor: value > 0 ? 'pointer' : 'default',
      }}
    >
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-zinc-400 mt-1 leading-tight">{label}</div>
      <div className="text-xs mt-1" style={{ color: `${color}80` }}>{pct}% of services</div>
      {value > 0 && (
        <div className="text-[10px] mt-1.5" style={{ color: `${color}60` }}>
          {active ? '▲ hide list' : '▼ show list'}
        </div>
      )}
    </button>
  );
}

const TEAM_COLORS = [
  '#22d3ee','#3b82f6','#8b5cf6','#14b8a6','#f59e0b',
  '#ec4899','#10b981','#f97316','#6366f1','#06b6d4',
  '#a855f7','#ef4444','#84cc16','#e879f9',
];

function TeamDonut({ data, total, onSelectTeam, selectedTeam }: {
  data: [string, number][];
  total: number;
  onSelectTeam: (name: string, color: string) => void;
  selectedTeam?: string;
}) {
  const radius = 80, cx = 100, cy = 100, strokeWidth = 28;
  const startAngles = data.reduce<number[]>((acc, _, i) => {
    if (i === 0) return [0];
    const prevAngle = (data[i - 1][1] / total) * 360;
    return [...acc, acc[i - 1] + prevAngle];
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="relative w-[180px] h-[180px] shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={radius} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
            {data.map(([team, count], i) => {
              const angle = (count / total) * 360;
              const start = startAngles[i];
              const end   = start + angle;
              const color = TEAM_COLORS[i % TEAM_COLORS.length];
              const isSelected = selectedTeam === team;
              if (angle < 0.5) return null;
              if (angle >= 359.5) return (
                <circle key={i} cx={cx} cy={cy} r={radius} fill="transparent"
                  stroke={color} strokeWidth={strokeWidth}
                  opacity={selectedTeam && !isSelected ? 0.3 : 1}
                  onClick={() => onSelectTeam(team, color)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} />
              );
              const x1 = cx + radius * Math.cos((start * Math.PI) / 180);
              const y1 = cy + radius * Math.sin((start * Math.PI) / 180);
              const x2 = cx + radius * Math.cos((end   * Math.PI) / 180);
              const y2 = cy + radius * Math.sin((end   * Math.PI) / 180);
              return (
                <path key={i}
                  d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`}
                  fill="transparent" stroke={color}
                  strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                  opacity={selectedTeam && !isSelected ? 0.3 : 1}
                  onClick={() => onSelectTeam(team, color)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {selectedTeam ? (
              <>
                <div className="text-2xl font-black text-zinc-100">
                  {data.find(([t]) => t === selectedTeam)?.[1] ?? 0}
                </div>
                <div className="text-xs text-zinc-400 text-center max-w-[80px] truncate">
                  {selectedTeam === 'unknown' ? 'unowned' : selectedTeam}
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-black text-zinc-100">{total}</div>
                <div className="text-xs uppercase tracking-widest text-zinc-500">services</div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map(([team, count], i) => {
          const color      = TEAM_COLORS[i % TEAM_COLORS.length];
          const isSelected = selectedTeam === team;
          return (
            <button key={team}
              onClick={() => onSelectTeam(team, color)}
              className="flex items-center gap-2 transition-all text-left rounded px-1 py-0.5 hover:bg-white/3"
              style={{ opacity: selectedTeam && !isSelected ? 0.4 : 1 }}
            >
              <span className="w-2 h-2 rounded-full shrink-0 transition-transform"
                style={{ background: color, transform: isSelected ? 'scale(1.4)' : 'scale(1)' }} />
              <span className="text-xs truncate transition-colors"
                style={{ color: isSelected ? '#e2e8f0' : '#a1a1aa' }}
                title={team}>
                {team === 'unknown' ? <span className="text-red-400">unowned</span> : team}
              </span>
              <span className="text-xs text-zinc-600 font-mono ml-auto">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}