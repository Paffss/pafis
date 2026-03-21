import { NextResponse } from 'next/server';
import { getGraph } from '@/lib/graph/builder';

export interface ServiceRisk {
  name: string;
  team: string;
  critical: string[];
  warnings: string[];
  score: number; // higher = more risky
}

export async function GET() {
  const graph = getGraph();
  const risks: ServiceRisk[] = [];

  for (const node of graph.nodes.values()) {
    if (node.type !== 'deployment') continue;

    const critical: string[] = [];
    const warnings: string[] = [];

    // Critical risks
    if (!node.metadata.cpuLimit && !node.metadata.memoryLimit)
      critical.push('No resource limits');
    else if (!node.metadata.cpuLimit)
      warnings.push('No CPU limit');
    else if (!node.metadata.memoryLimit)
      warnings.push('No memory limit');

    if (!node.metadata.hasLivenessProbe)
      critical.push('No liveness probe');

    if (!node.metadata.hasReadinessProbe)
      critical.push('No readiness probe');

    if (node.metadata.image?.endsWith(':latest'))
      critical.push('Using :latest image tag');

    // Warnings
    if ((node.metadata.replicas ?? 1) === 1)
      warnings.push('Single replica (SPOF)');

    if (!node.metadata.cpuRequest && !node.metadata.memoryRequest)
      warnings.push('No resource requests');

    if (!node.metadata.ports || node.metadata.ports.length === 0)
      warnings.push('No ports defined');

    // Only include services that have at least one issue
    if (critical.length === 0 && warnings.length === 0) continue;

    risks.push({
      name: node.name,
      team: node.metadata.ownerTeam || 'unknown',
      critical,
      warnings,
      score: critical.length * 10 + warnings.length * 3,
    });
  }

  // Sort by score descending
  risks.sort((a, b) => b.score - a.score);

  return NextResponse.json(risks);
}