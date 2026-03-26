'use client';

import { useEffect, useState } from 'react';
import SlotMachine from './SlotMachine';
import ManifestViewer from './ManifestViewer';

interface ManifestData {
  name: string;
  type: string;
  metadata: {
    ownerTeam?: string;
    replicas?: number;
    framework?: string;
    tech?: string;
    image?: string;
    cpuRequest?: string;
    memoryRequest?: string;
    cpuLimit?: string;
    memoryLimit?: string;
    hasLivenessProbe?: boolean;
    hasReadinessProbe?: boolean;
    ports?: { name: string; port: number }[];
    environment?: string;
  };
  family: Array<{
    name: string;
    replicas: number;
    cpuRequest: string;
    memoryRequest: string;
  }>;
}

interface ServiceHeaderProps {
  name: string;
}

const ENV_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  production: { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5', dot: '#ef4444' },
  staging:    { bg: 'rgba(234,179,8,0.15)',  text: '#fde047', dot: '#eab308' },
  qa:         { bg: 'rgba(249,115,22,0.15)', text: '#fdba74', dot: '#f97316' },
  dev:        { bg: 'rgba(34,197,94,0.15)',  text: '#86efac', dot: '#22c55e' },
  unknown:    { bg: 'rgba(113,113,122,0.15)',text: '#a1a1aa', dot: '#71717a' },
};

export default function ServiceHeader({ name }: ServiceHeaderProps) {
  const [data, setData]       = useState<ManifestData | null>(null);
  const [showYaml, setShowYaml] = useState(false);

  useEffect(() => {
    fetch(`/api/manifest/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [name]);

  if (!data) return null;

  const m   = data.metadata;
  const env = m.environment;
  const envStyle = env ? (ENV_STYLES[env] || ENV_STYLES.unknown) : null;

  // Derive image tag
  const imageTag = m.image?.split(':')[1] || null;
  const isLatest = imageTag === 'latest';

  return (
    <>
      <div className="glass-panel p-5">
        {/* Top row — name + badges + actions */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {/* Env dot */}
            {envStyle && (
              <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: envStyle.dot, boxShadow: `0 0 8px ${envStyle.dot}60` }} />
            )}
            <h2 className="text-2xl font-black text-zinc-100 tracking-tight">{data.name}</h2>

            {/* Team badge */}
            {m.ownerTeam ? (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}>
                {m.ownerTeam}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                no owner
              </span>
            )}

            {/* Env badge */}
            {env && envStyle && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: envStyle.bg, color: envStyle.text, border: `1px solid ${envStyle.dot}40` }}>
                {env}
              </span>
            )}

            {/* Framework / tech */}
            {m.framework && (
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{m.framework}</span>
            )}
            {m.tech && (
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{m.tech}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowYaml(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all font-mono"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
            >
              {'<'}/{'>'} YAML
            </button>
          </div>
        </div>

        {/* Stats row — single line like the reference */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCard
            label="REPLICAS"
            value={m.replicas?.toString() || '?'}
            warn={m.replicas === 1}
            warnMsg={m.replicas === 1 ? 'SPOF' : undefined}
          />
          <StatCard label="CPU REQ"   value={m.cpuRequest   || 'none'} />
          <StatCard label="MEM REQ"   value={m.memoryRequest || 'none'} />
          <StatCard
            label="CPU LIMIT"
            value={m.cpuLimit || 'not set'}
            warn={!m.cpuLimit}
            warnMsg={!m.cpuLimit ? 'unset' : undefined}
          />
          <StatCard
            label="LIVENESS"
            value={m.hasLivenessProbe ? 'Yes' : 'No'}
            warn={!m.hasLivenessProbe}
            good={m.hasLivenessProbe}
          />
          <StatCard
            label="READINESS"
            value={m.hasReadinessProbe ? 'Yes' : 'No'}
            warn={!m.hasReadinessProbe}
            good={m.hasReadinessProbe}
          />
        </div>

        {/* Image tag row */}
        {m.image && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Image</span>
            <span className="text-xs font-mono text-zinc-400 truncate">{m.image}</span>
            {imageTag && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto shrink-0"
                style={{
                  background: isLatest ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
                  color:      isLatest ? '#fca5a5' : '#86efac',
                  border:     `1px solid ${isLatest ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`,
                }}
              >
                {isLatest ? '⚠ :latest' : `✓ ${imageTag}`}
              </span>
            )}
          </div>
        )}

        {/* Family */}
        {data.family.length > 1 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mr-2">Family</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.family.map(f => (
                <span
                  key={f.name}
                  className={`text-xs px-2 py-0.5 rounded ${f.name === name ? 'bg-blue-500/30 text-blue-200' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  {f.name} (<SlotMachine value={f.replicas.toString()} />r)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showYaml && <ManifestViewer name={name} onClose={() => setShowYaml(false)} />}
    </>
  );
}

function StatCard({ label, value, warn, good, warnMsg }: {
  label: string;
  value: string;
  warn?: boolean;
  good?: boolean;
  warnMsg?: string;
}) {
  const color = good ? '#4ade80' : warn ? '#fbbf24' : '#e2e8f0';
  const bg    = good ? 'rgba(34,197,94,0.06)' : warn ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)';
  const border = good ? 'rgba(34,197,94,0.15)' : warn ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="px-3 py-2.5 rounded-lg text-center" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className="text-base font-mono font-black truncate" style={{ color }}>
        <SlotMachine value={value} />
      </div>
      {warnMsg && (
        <div className="text-[9px] mt-0.5" style={{ color: `${color}80` }}>{warnMsg}</div>
      )}
    </div>
  );
}