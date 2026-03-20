import { NextRequest, NextResponse } from 'next/server';
import { searchServices, getAllDeployments } from '@/lib/graph/query';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (query) {
    const results = searchServices(query, 30);
    return NextResponse.json(results);
  }

  // Return all deployments sorted by name
  const deployments = getAllDeployments();
  const items = deployments.map(d => ({
    name: d.name,
    type: d.type,
    ownerTeam: d.metadata.ownerTeam || '',
    id: d.id,
  }));
  return NextResponse.json(items);
}
