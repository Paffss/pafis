'use client';

import { useEffect, useState } from 'react';
import SlotMachine from './SlotMachine';

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

export default function ServiceHeader({ name }: ServiceHeaderProps) {
  const [data, setData] = useState<ManifestData | null>(null);

  useEffect(() => {
    fetch(`/api/manifest/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [name]);

  if (!data) return null;

  const m = data.metadata;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-100">{data.name}</h2>
          {m.ownerTeam && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
              {m.ownerTeam}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {m.framework && <span className="px-2 py-0.5 bg-zinc-800 rounded">{m.framework}</span>}
          {m.tech && <span className="px-2 py-0.5 bg-zinc-800 rounded">{m.tech}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Replicas" value={m.replicas?.toString() || '?'} warn={m.replicas === 1} />
        <Stat label="CPU Req" value={m.cpuRequest || 'none'} />
        <Stat label="Mem Req" value={m.memoryRequest || 'none'} />
        <Stat label="CPU Limit" value={m.cpuLimit || 'none'} warn={!m.cpuLimit} />
        <Stat label="Liveness" value={m.hasLivenessProbe ? 'Yes' : 'No'} warn={!m.hasLivenessProbe} />
        <Stat label="Readiness" value={m.hasReadinessProbe ? 'Yes' : 'No'} warn={!m.hasReadinessProbe} />
      </div>

      {data.family.length > 1 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">Family: </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {data.family.map(f => (
              <span
                key={f.name}
                className={`text-xs px-2 py-0.5 rounded ${
                  f.name === name ? 'bg-blue-500/30 text-blue-200' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {f.name} (<SlotMachine value={f.replicas.toString()} />r)
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="glass-panel px-4 py-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className={`text-2xl font-mono font-black ${warn ? 'text-amber-400' : 'text-cyan-300'}`}>
        <SlotMachine value={value} />
      </div>
    </div>
  );
}
