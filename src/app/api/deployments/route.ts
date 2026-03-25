import { NextResponse } from 'next/server';
import { getAllDeployments } from '@/lib/graph/query';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deployments = getAllDeployments();

  const result = deployments.map(node => ({
    name:             node.name,
    team:             node.metadata.ownerTeam || 'unknown',
    environment:      node.metadata.environment || 'unknown',
    replicas:         node.metadata.replicas ?? 1,
    image:            node.metadata.image || '',
    cpuRequest:       node.metadata.cpuRequest || null,
    memoryRequest:    node.metadata.memoryRequest || null,
    cpuLimit:         node.metadata.cpuLimit || null,
    memoryLimit:      node.metadata.memoryLimit || null,
    hasLivenessProbe: node.metadata.hasLivenessProbe ?? false,
    hasReadinessProbe:node.metadata.hasReadinessProbe ?? false,
    // Derived risk flags
    noLimits:         !node.metadata.cpuLimit && !node.metadata.memoryLimit,
    latestTag:        node.metadata.image?.endsWith(':latest') ?? false,
    singleReplica:    (node.metadata.replicas ?? 1) === 1,
    noLivenessProbe:  !node.metadata.hasLivenessProbe,
    noOwnerTeam:      !node.metadata.ownerTeam,
  }));

  return NextResponse.json(result);
}