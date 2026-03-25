import { NextRequest, NextResponse } from 'next/server';
import { searchServices, getFilterOptions, getAllDeployments } from '@/lib/graph/query';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (query === '__filters__') {
    // Return autocomplete options for filter tokens
    return NextResponse.json(getFilterOptions());
  }

  if (query) {
    const results = searchServices(query, 30);
    return NextResponse.json(results);
  }

  // Return all deployments sorted by name
  const deployments = getAllDeployments();
  const items = deployments.map(d => ({
    name:        d.name,
    type:        d.type,
    ownerTeam:   d.metadata.ownerTeam || '',
    environment: d.metadata.environment || 'unknown',
    id:          d.id,
    noLimits:        !d.metadata.cpuLimit && !d.metadata.memoryLimit,
    latestTag:       d.metadata.image?.endsWith(':latest') ?? false,
    noLivenessProbe: !d.metadata.hasLivenessProbe,
    singleReplica:   (d.metadata.replicas ?? 1) === 1,
  }));
  return NextResponse.json(items);
}