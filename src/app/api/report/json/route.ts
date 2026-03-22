import { NextResponse } from 'next/server';
import { getGraph, getGraphStats } from '@/lib/graph/builder';

export async function GET() {
  const graph = getGraph();
  const stats = getGraphStats();

  const risks: Array<{
    name: string;
    team: string;
    critical: string[];
    warnings: string[];
    score: number;
  }> = [];

  for (const node of graph.nodes.values()) {
    if (node.type !== 'deployment') continue;
    const critical: string[] = [];
    const warnings: string[] = [];

    if (!node.metadata.cpuLimit && !node.metadata.memoryLimit) critical.push('No resource limits');
    else if (!node.metadata.cpuLimit) warnings.push('No CPU limit');
    else if (!node.metadata.memoryLimit) warnings.push('No memory limit');
    if (!node.metadata.hasLivenessProbe) critical.push('No liveness probe');
    if (!node.metadata.hasReadinessProbe) critical.push('No readiness probe');
    if (node.metadata.image?.endsWith(':latest')) critical.push('Using :latest tag');
    if ((node.metadata.replicas ?? 1) === 1) warnings.push('Single replica (SPOF)');
    if (!node.metadata.cpuRequest && !node.metadata.memoryRequest) warnings.push('No resource requests');

    if (critical.length > 0 || warnings.length > 0) {
      risks.push({
        name: node.name,
        team: node.metadata.ownerTeam || 'unowned',
        critical,
        warnings,
        score: critical.length * 10 + warnings.length * 3,
      });
    }
  }

  risks.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    generatedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    stats,
    risks,
  });
}