import { NextRequest, NextResponse } from 'next/server';
import { getServiceSubgraph } from '@/lib/graph/query';
import { generateMermaid } from '@/lib/graph/mermaid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const depth = parseInt(request.nextUrl.searchParams.get('depth') || '2');

  const subgraph = getServiceSubgraph(name, depth);

  if (subgraph.nodes.length === 0) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  const mermaid = generateMermaid(subgraph);

  return NextResponse.json({
    mermaid,
    nodeCount: subgraph.nodes.length,
    edgeCount: subgraph.edges.length,
    nodes: subgraph.nodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      metadata: n.metadata,
    })),
    edges: subgraph.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
    })),
  });
}