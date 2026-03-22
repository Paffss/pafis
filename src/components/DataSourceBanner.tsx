'use client';

import { useState } from 'react';

interface DataSourceBannerProps {
  mode?: 'sample' | 'cluster' | 'auto';
}

export default function DataSourceBanner({ mode = 'auto' }: DataSourceBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Auto-detect: if PAFIS_BASE contains 'sample' or data count is small it's sample
  const isSample = mode === 'sample';

  return (
    <div className="relative mx-6 mt-3 rounded-lg text-sm overflow-hidden"
      style={{
        background: isSample ? 'rgba(251,191,36,0.06)' : 'rgba(34,211,238,0.06)',
        border: `1px solid ${isSample ? 'rgba(251,191,36,0.2)' : 'rgba(34,211,238,0.15)'}`,
      }}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span>{isSample ? '🧪' : '📡'}</span>
          <span className="text-zinc-300">
            {isSample
              ? <><span className="text-yellow-400 font-medium">Sample data</span> — pre-generated fintech/SaaS/DevOps manifests for demo purposes</>
              : <><span className="text-cyan-400 font-medium">Snapshot data</span> — manifests extracted from a Kubernetes cluster at deploy time</>
            }
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
          >
            {expanded ? 'less' : 'how does this work?'}
          </button>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors text-base leading-none ml-4">
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
          <p className="text-zinc-400 leading-relaxed">
            PAFIS is a <strong className="text-zinc-200">static snapshot tool</strong> — it reads Kubernetes manifest files
            from disk at startup, parses them into an in-memory graph, and serves everything from memory.
            It does <strong className="text-zinc-200">not</strong> connect to your cluster at runtime.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Step 1 — Extract</div>
              <div className="text-xs text-zinc-400 font-mono">npm run fetch:minikube</div>
              <div className="text-xs text-zinc-500 mt-1">Dumps all K8s manifests from your cluster into <code className="text-zinc-400">./data/</code></div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Step 2 — Build</div>
              <div className="text-xs text-zinc-400 font-mono">docker build -t pafis .</div>
              <div className="text-xs text-zinc-500 mt-1">Bakes the manifest snapshot into the Docker image</div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Step 3 — Run</div>
              <div className="text-xs text-zinc-400 font-mono">docker run pafis</div>
              <div className="text-xs text-zinc-500 mt-1">Serves the graph anywhere — no cluster access needed</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>✅ Works offline and air-gapped</span>
            <span>✅ No RBAC or cluster permissions at runtime</span>
            <span>✅ Can run in CI/CD to analyse manifests pre-deploy</span>
            <span>⚠️ Data is a point-in-time snapshot — re-fetch to update</span>
          </div>

          <p className="text-xs text-zinc-600">
            For live cluster integration, PAFIS could be extended with a <code>kubectl watch</code> mode or a Kubernetes
            operator that auto-refreshes the graph on manifest changes. This is on the roadmap.
          </p>
        </div>
      )}
    </div>
  );
}