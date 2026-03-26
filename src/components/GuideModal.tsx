'use client';

import { useState, useEffect } from 'react';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    icon: '🔍',
    title: 'What is PAFIS?',
    content: 'PAFIS (Platform Infrastructure Intelligence System) reads Kubernetes manifest files, builds a dependency graph, and gives you cost estimates, risk analysis, and service intelligence — all from static manifests. No live cluster access required.',
  },
  {
    icon: '🔎',
    title: 'How does search work?',
    content: 'Type any service name for fuzzy search. Use filter tokens for precise queries:',
    tokens: [
      { token: 'team:payments',      desc: 'filter by owner team' },
      { token: 'env:production',     desc: 'filter by environment' },
      { token: 'risk:nolimits',      desc: 'services with no resource limits' },
      { token: 'risk:latest',        desc: 'services using :latest image tag' },
      { token: 'risk:noprobe',       desc: 'services with no liveness probe' },
      { token: 'risk:single',        desc: 'services with single replica' },
    ],
  },
  {
    icon: '💰',
    title: 'How are costs calculated?',
    content: 'Costs use approximate AWS EKS on-demand pricing: $0.031/core-hour and $0.004/GiB-hour × 730 hrs/month, based on t3.medium nodes in us-east-1. Additional costs:',
    bullets: [
      'LoadBalancers: $18/mo per AWS NLB (base fee)',
      'Storage (PVCs): $0.08–$0.125/GiB-month by class (gp3/gp2/io1)',
      'Connect Prometheus for real usage-based cost vs. requested cost',
    ],
  },
  {
    icon: '⚠️',
    title: 'What are the risk checks?',
    content: 'PAFIS analyses each deployment manifest for production readiness:',
    bullets: [
      'No resource limits — pod can consume unlimited CPU/memory',
      'No liveness probe — Kubernetes can\'t detect if the app is stuck',
      'No readiness probe — traffic may be sent before app is ready',
      'Using :latest tag — non-reproducible, pulls different image on each restart',
      'Single replica — single point of failure, no rolling updates',
      'No owner team label — unowned service, nobody to page',
    ],
  },
  {
    icon: '💥',
    title: 'What is blast radius / impact analysis?',
    content: 'On each service page, the Impact Panel shows which services call this one (directly or transitively). If this service goes down, all services in its blast radius are affected. Criticality grades: LEAF → LOW → MEDIUM → HIGH → CRITICAL.',
  },
  {
    icon: '🌍',
    title: 'What do the environments mean?',
    content: 'Environments are detected from deployment labels (environment:), APP_ENV env vars, or namespace naming. Colours: 🔴 Production  🟡 Staging  🟠 QA  🟢 Dev',
  },
  {
    icon: '🔌',
    title: 'How do I connect a live cluster?',
    content: 'Run the fetch script to pull manifests from any cluster:',
    code: 'npm run fetch:minikube\n# or for any context:\nbash scripts/fetch-manifests.sh --context <your-context>',
    bullets: [
      'Requires kubectl with read-only RBAC permissions',
      'Set PAFIS_BASE env var to point at your manifest directory',
      'Prometheus URL can be set via PROMETHEUS_URL for real metrics',
    ],
  },
  {
    icon: '📦',
    title: 'Deploy anywhere',
    content: 'PAFIS is a single Docker container — manifests baked in at build time:',
    code: 'docker build -t pafis .\ndocker run -p 3000:3000 pafis',
  },
];

export default function GuideModal({ open, onClose }: GuideModalProps) {
  const [activeSection, setActiveSection] = useState(0);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const section = SECTIONS[activeSection];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(6,18,32,0.98)', border: '1px solid rgba(34,211,238,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-lg">⚡</span>
            <span className="font-black text-zinc-100 tracking-tight">Mission Briefing</span>
            <span className="text-xs text-zinc-500 font-mono ml-1">— how PAFIS works</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex h-[480px]">
          {/* Sidebar nav */}
          <div className="w-48 border-r border-white/5 py-3 shrink-0 overflow-y-auto">
            {SECTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className="w-full text-left px-4 py-2.5 text-xs transition-all flex items-center gap-2"
                style={{
                  background:    i === activeSection ? 'rgba(34,211,238,0.08)' : 'transparent',
                  borderLeft:    `2px solid ${i === activeSection ? '#22d3ee' : 'transparent'}`,
                  color:         i === activeSection ? '#e2e8f0' : '#71717a',
                }}
              >
                <span>{s.icon}</span>
                <span className="leading-tight">{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{section.icon}</span>
                <h3 className="text-base font-bold text-zinc-100">{section.title}</h3>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed">{section.content}</p>

              {section.tokens && (
                <div className="space-y-2">
                  {section.tokens.map(t => (
                    <div key={t.token} className="flex items-center gap-3">
                      <code
                        className="text-xs px-2 py-1 rounded font-mono shrink-0"
                        style={{ background: 'rgba(34,211,238,0.1)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.2)' }}
                      >
                        {t.token}
                      </code>
                      <span className="text-xs text-zinc-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              {section.bullets && (
                <ul className="space-y-1.5">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                      <span className="text-cyan-500 mt-0.5 shrink-0">›</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {section.code && (
                <pre
                  className="text-xs p-3 rounded-lg font-mono leading-relaxed overflow-x-auto"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#86efac' }}
                >
                  {section.code}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
          <button
            onClick={() => setActiveSection(i => Math.max(0, i - 1))}
            disabled={activeSection === 0}
            className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-600">{activeSection + 1} / {SECTIONS.length}</span>
          <button
            onClick={() => activeSection === SECTIONS.length - 1 ? onClose() : setActiveSection(i => i + 1)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            {activeSection === SECTIONS.length - 1 ? 'Close ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}