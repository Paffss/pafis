import { NextRequest, NextResponse } from 'next/server';
import { getImpactAnalysis } from '@/lib/graph/query';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const impact = getImpactAnalysis(name);
  return NextResponse.json(impact);
}