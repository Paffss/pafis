'use client';

import { useEffect, useState } from 'react';

interface ReportData {
  generatedAt: string;
  stats: {
    deployments: number;
    services: number;
    helmCharts: number;
    configmaps: number;
    secrets: number;
    databases: number;
    serviceMonitors: number;
    networkPolicies: number;
    totalNodes: number;
    edges: number;
    noLimits: number;
    singleReplica: number;
    latestTag: number;
    noLivenessProbe: number;
    noOwnerTeam: number;
    teamDistribution: Record<string, number>;
  };
  risks: Array<{
    name: string;
    team: string;
    critical: string[];
    warnings: string[];
    score: number;
  }>;
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/report/json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">Generating report...</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-red-500">Failed to load report data</p>
    </div>
  );

  const { stats, risks } = data;
  const readinessPct = stats.deployments > 0
    ? Math.round(((stats.deployments - stats.noLimits - stats.noLivenessProbe) / stats.deployments) * 100)
    : 100;
  const teamEntries = Object.entries(stats.teamDistribution).sort((a, b) => b[1] - a[1]);
  const pct = (v: number, t: number) => t > 0 ? Math.round((v / t) * 100) : 0;

  return (
    <>
      {/* Print button — hidden in print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg"
          style={{ background: '#0ea5e9' }}
        >
          ↓ Save as PDF
        </button>
        <a href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 shadow-lg">
          ← Back
        </a>
      </div>

      {/* Report content */}
      <div className="report-page bg-white text-gray-900 min-h-screen p-12 max-w-4xl mx-auto">

        {/* Header */}
        <div className="border-b-2 border-sky-500 pb-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">PAFIS</h1>
              <p className="text-sky-600 font-medium">Predictive Analysis For Infrastructure Services</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-medium text-gray-700">Cluster Report</p>
              <p>{data.generatedAt}</p>
            </div>
          </div>
        </div>

        {/* Summary grid */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">Cluster Summary</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Deployments', value: stats.deployments, highlight: true },
              { label: 'Services', value: stats.services },
              { label: 'Helm Charts', value: stats.helmCharts },
              { label: 'Databases', value: stats.databases },
              { label: 'ConfigMaps', value: stats.configmaps },
              { label: 'Secrets', value: stats.secrets },
              { label: 'Graph Nodes', value: stats.totalNodes },
              { label: 'Graph Edges', value: stats.edges },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="text-center p-3 rounded-lg border"
                style={{ borderColor: highlight ? '#0ea5e9' : '#e5e7eb', background: highlight ? '#f0f9ff' : '#f9fafb' }}>
                <div className="text-2xl font-black" style={{ color: highlight ? '#0284c7' : '#1f2937' }}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Production Readiness */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Production Readiness</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black" style={{ color: readinessPct >= 80 ? '#16a34a' : readinessPct >= 60 ? '#d97706' : '#dc2626' }}>
                {readinessPct}%
              </span>
              <span className="text-sm text-gray-500">score</span>
            </div>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-gray-600 font-semibold">Check</th>
                <th className="text-center py-2 text-gray-600 font-semibold">Affected</th>
                <th className="text-center py-2 text-gray-600 font-semibold">% of Services</th>
                <th className="text-center py-2 text-gray-600 font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'No Resource Limits', value: stats.noLimits, severity: 'Critical', color: '#dc2626' },
                { label: 'Single Replica (SPOF)', value: stats.singleReplica, severity: 'Warning', color: '#d97706' },
                { label: 'Using :latest Image Tag', value: stats.latestTag, severity: 'Critical', color: '#dc2626' },
                { label: 'No Liveness Probe', value: stats.noLivenessProbe, severity: 'Warning', color: '#d97706' },
                { label: 'No Owner Team Label', value: stats.noOwnerTeam || 0, severity: 'Warning', color: '#d97706' },
              ].map(({ label, value, severity, color }) => (
                <tr key={label} className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-700">{label}</td>
                  <td className="py-2.5 text-center font-bold" style={{ color: value > 0 ? color : '#16a34a' }}>{value}</td>
                  <td className="py-2.5 text-center text-gray-500">{pct(value, stats.deployments)}%</td>
                  <td className="py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: value > 0 ? `${color}15` : '#dcfce7', color: value > 0 ? color : '#16a34a' }}>
                      {value > 0 ? severity : '✓ OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Team Ownership */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">Team Ownership</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-gray-600 font-semibold">Team</th>
                <th className="text-center py-2 text-gray-600 font-semibold">Services</th>
                <th className="text-right py-2 text-gray-600 font-semibold">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {teamEntries.map(([team, count]) => (
                <tr key={team} className="border-b border-gray-100">
                  <td className="py-2 font-medium" style={{ color: team === 'unknown' ? '#dc2626' : '#1f2937' }}>
                    {team === 'unknown' ? '⚠ Unowned' : team}
                  </td>
                  <td className="py-2 text-center text-gray-700">{count}</td>
                  <td className="py-2 text-right text-gray-500">{pct(count, stats.deployments)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Top Risks */}
        {risks.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">
              Service Risk Report <span className="text-base font-normal text-gray-500 normal-case">({risks.length} services with issues)</span>
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-gray-600 font-semibold">Service</th>
                  <th className="text-left py-2 text-gray-600 font-semibold">Team</th>
                  <th className="text-left py-2 text-gray-600 font-semibold">Issues</th>
                  <th className="text-center py-2 text-gray-600 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {risks.slice(0, 20).map(svc => (
                  <tr key={svc.name} className="border-b border-gray-100">
                    <td className="py-2 font-mono text-xs text-gray-800">{svc.name}</td>
                    <td className="py-2 text-xs text-gray-500">{svc.team}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {svc.critical.map(c => (
                          <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">{c}</span>
                        ))}
                        {svc.warnings.map(w => (
                          <span key={w} className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-100">{w}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-center font-bold text-sm"
                      style={{ color: svc.score >= 30 ? '#dc2626' : svc.score >= 15 ? '#d97706' : '#6b7280' }}>
                      {svc.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {risks.length > 20 && (
              <p className="text-xs text-gray-400 mt-2 text-right">Showing top 20 of {risks.length} services with issues</p>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 flex justify-between">
          <span>PAFIS — Predictive Analysis For Infrastructure Services</span>
          <span>github.com/Paffss/pafis</span>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .report-page { padding: 8mm; max-width: none; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </>
  );
}