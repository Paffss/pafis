import { NextRequest, NextResponse } from 'next/server';
import { findNodeByName } from '@/lib/graph/query';
import { getServiceFamily } from '@/lib/graph/query';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const node = findNodeByName(name);

  if (!node) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const family = getServiceFamily(name);

  return NextResponse.json({
    name: node.name,
    type: node.type,
    metadata: node.metadata,
    rawYaml: node.rawYaml || '',
    family: family.map(f => ({
      name: f.name,
      replicas: f.metadata.replicas,
      cpuRequest: f.metadata.cpuRequest,
      memoryRequest: f.metadata.memoryRequest,
    })),
  });
}
