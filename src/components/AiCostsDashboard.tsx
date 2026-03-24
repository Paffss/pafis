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

// Mock enterprise usage data
const MOCK_ENTERPRISE_TEAMS = [
  { team: 'payments',   users: 8,  inputTokens: 4_820_000, outputTokens: 1_240_000, topUser: 'alex.k',    trend: '+12%' },
  { team: 'backend',    users: 12, inputTokens: 3_100_000, outputTokens: 890_000,  topUser: 'maria.s',   trend: '+5%'  },
  { team: 'platform',   users: 6,  inputTokens: 2_450_000, outputTokens: 720_000,  topUser: 'john.d',    trend: '-3%'  },
  { team: 'compliance', users: 4,  inputTokens: 1_890_000, outputTokens: 560_000,  topUser: 'petra.v',   trend: '+21%' },
  { team: 'data',       users: 5,  inputTokens: 1_560_000, outputTokens: 480_000,  topUser: 'ivan.m',    trend: '+8%'  },
  { team: 'frontend',   users: 9,  inputTokens: 980_000,  outputTokens: 310_000,  topUser: 'sara.t',    trend: '-1%'  },
  { team: 'ops',        users: 3,  inputTokens: 670_000,  outputTokens: 210_000,  topUser: 'dimitar.d', trend: '+4%'  },
];

const INPUT_COST_PER_M  = 3.00;
const OUTPUT_COST_PER_M = 15.00;

function calcCost(input: number, output: number) {
  return (input / 1_000_000) * INPUT_COST_PER_M + (output / 1_000_000) * OUTPUT_COST_PER_M;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

interface AiCostsDashboardProps {
  onSelectService?: (name: string) => void;
}

export default function AiCostsDashboard({ onSelectService }: AiCostsDashboardProps) {
  const [pafisData, setPafisData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch('/api/ai-usage').then(r => r.json()).then(setPafisData).catch(() => {});
  }, []);

  const enterpriseTeams = MOCK_ENTERPRISE_TEAMS.map(t => ({
    ...t,
    costUsd: calcCost(t.inputTokens, t.outputTokens),
  })).sort((a, b) => b.costUsd - a.costUsd);

  const totalEnterpriseCost = enterpriseTeams.reduce((s, t) => s + t.costUsd, 0);
  const totalEnterpriseTokens = enterpriseTeams.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0);
  const maxTeamCost = enterpriseTeams[0]?.costUsd ?? 1;

  return (
    <div className="space-y-5">

      {/* ── Enterprise Claude Usage ─────────────────────────────────────────── */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Enterprise Claude Usage</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                MOCK DATA
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-0.5">
              Team-level Claude API budget tracking · plug in your Admin API key for real data
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-zinc-100">${totalEnterpriseCost.toFixed(2)}</div>
            <div className="text-xs text-zinc-500">{fmt(totalEnterpriseTokens)} tokens this month</div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total spend',    value: `$${totalEnterpriseCost.toFixed(2)}`,             color: '#f87171' },
            { label: 'Teams tracked',  value: enterpriseTeams.length.toString(),                  color: '#22d3ee' },
            { label: 'Total users',    value: enterpriseTeams.reduce((s,t) => s+t.users, 0).toString(), color: '#a78bfa' },
            { label: 'Highest growth', value: '+21% compliance',                                  color: '#fbbf24' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-lg text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-base font-black" style={{ color }}>{value}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Team breakdown */}
        <div className="space-y-2">
          {enterpriseTeams.map((team, i) => {
            const barWidth = (team.costUsd / maxTeamCost) * 100;
            const inputPct = (team.inputTokens / (team.inputTokens + team.outputTokens)) * 100;
            const trendUp = team.trend.startsWith('+');
            return (
              <div key={team.team} className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                    <span className="text-sm font-bold text-zinc-200 capitalize">{team.team}</span>
                    <span className="text-xs text-zinc-600">{team.users} users</span>
                    <span className="text-xs text-zinc-500">top: <span className="text-zinc-400">{team.topUser}</span></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono" style={{ color: trendUp ? '#f87171' : '#4ade80' }}>
                      {team.trend}
                    </span>
                    <span className="text-sm font-bold text-zinc-200">${team.costUsd.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/50">
                  <div className="h-full rounded-l-full" style={{ width: `${barWidth * inputPct / 100}%`, background: '#22d3ee' }} />
                  <div className="h-full rounded-r-full" style={{ width: `${barWidth * (100 - inputPct) / 100}%`, background: '#a78bfa' }} />
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-[10px] text-zinc-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" />
                    {fmt(team.inputTokens)} in
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1" />
                    {fmt(team.outputTokens)} out
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <span>💡</span>
          <span className="text-zinc-400">
            This is mock data showing what enterprise Claude budget tracking would look like.
            Connect a real <code className="text-zinc-300 bg-zinc-800 px-1 rounded">sk-ant-admin...</code> key
            via the Anthropic Admin API to see actual usage broken down by team, user, and project.
          </span>
        </div>
      </div>

      {/* ── PAFIS AI Analysis Usage ─────────────────────────────────────────── */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">PAFIS Analysis Usage</h3>
            <p className="text-xs text-zinc-600 mt-0.5">Token consumption from AI service analysis in this session</p>
          </div>
          {pafisData && pafisData.summary.services > 0 && (
            <div className="text-right">
              <div className="text-lg font-black text-zinc-100">${pafisData.summary.totalCost.toFixed(4)}</div>
              <div className="text-xs text-zinc-500">{pafisData.summary.totalCalls} analyses</div>
            </div>
          )}
        </div>

        {!pafisData || pafisData.services.length === 0 ? (
          <div className="py-4 text-center text-zinc-600 text-sm">
            No analyses run yet — click any service and run an AI analysis to track usage
          </div>
        ) : (
          <div className="space-y-1.5">
            {pafisData.services.map((svc, i) => {
              const maxCost = pafisData.services[0]?.costUsd ?? 1;
              const barWidth = maxCost > 0 ? (svc.costUsd / maxCost) * 100 : 0;
              return (
                <button key={svc.service} onClick={() => onSelectService?.(svc.service)}
                  className="w-full text-left group rounded-lg p-2.5 transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                      <span className="text-sm font-mono text-zinc-200 group-hover:text-violet-400 transition-colors">{svc.service}</span>
                      <span className="text-xs text-zinc-600">{svc.calls}x</span>
                    </div>
                    <span className="text-sm font-bold text-zinc-200">${svc.costUsd.toFixed(4)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800/50 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-zinc-600">{fmt(svc.inputTokens)} in · {fmt(svc.outputTokens)} out</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-zinc-700 border-t border-white/5 pt-2">
          $3/1M input · $15/1M output (Claude Sonnet) · resets on server restart
        </p>
      </div>

    </div>
  );
}