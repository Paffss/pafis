'use client';

import { useState } from 'react';

interface DataSourceBannerProps {
  mode?: 'sample' | 'cluster' | 'auto';
}

export default function DataSourceBanner({ mode = 'auto' }: DataSourceBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isSample = mode === 'sample';

  return (
    <div className="relative mx-6 mt-3 rounded-lg text-sm"
      style={{
        background: isSample ? 'rgba(251,191,36,0.06)' : 'rgba(34,211,238,0.06)',
        border: `1px solid ${isSample ? 'rgba(251,191,36,0.2)' : 'rgba(34,211,238,0.15)'}`,
      }}>

      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span>{isSample ? '🧪' : '📡'}</span>
          <span className="font-medium" style={{ color: isSample ? '#fbbf24' : '#22d3ee' }}>
            {isSample ? 'Demo data' : 'Cluster snapshot'}
          </span>
          <span className="text-zinc-400">
            — pre-generated sample manifests. Currently static, but PAFIS can connect to live clusters.
          </span>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors text-base leading-none ml-4 shrink-0">
          ✕
        </button>
      </div>

      {/* Always-visible body */}
      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">

        {/* Two column layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* How it works */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">How it works</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              PAFIS reads Kubernetes manifest files from disk, parses them into a dependency graph,
              and serves everything from memory.In static mode it works from a snapshot. Connected to a live cluster it would
              refresh automatically as the infrastructure changes.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 pt-1">
              <span>✅ Works offline and air-gapped</span>
              <span>✅ No cluster permissions at runtime</span>
              <span>✅ Usable in CI/CD pre-deploy checks</span>
              <span>🔄 Live mode possible via kubectl watch or K8s operator</span>
            </div>
          </div>

          {/* Cost estimation disclaimer */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Cost estimation methodology</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Costs are estimated using <strong className="text-zinc-300">approximate AWS EKS on-demand pricing</strong> —
              $0.031/core-hour and $0.004/GiB-hour × 730 hours/month.
              These are ballpark figures based on <code className="text-zinc-300 bg-zinc-800 px-1 rounded">t3.medium</code> nodes
              in us-east-1 and are useful for <strong className="text-zinc-300">relative comparisons</strong> between services,
              not precise billing.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 pt-1">
              <span>⚠️ Currently does not include storage or load balancer costs</span>
              <span>⚠️ Actual cost depends on instance type, region and pricing tier</span>
              <span>📊 Can be connected to Prometheus for real usage-based cost calculations</span>
            </div>
          </div>

        </div>

        {/* Steps row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { step: '1', title: 'Extract', cmd: 'npm run fetch:minikube', desc: 'Pull manifests from any K8s cluster' },
            { step: '2', title: 'Build',   cmd: 'docker build -t pafis .', desc: 'Snapshot baked into the Docker image' },
            { step: '3', title: 'Run',     cmd: 'docker run pafis',        desc: 'Serves anywhere, no cluster needed' },
          ].map(({ step, title, cmd, desc }) => (
            <div key={step} className="p-2.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Step {step} — {title}</div>
              <div className="text-xs text-zinc-300 font-mono mb-0.5">{cmd}</div>
              <div className="text-xs text-zinc-600">{desc}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}