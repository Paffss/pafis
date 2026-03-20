import { NextResponse } from 'next/server';
import { getGraphStats } from '@/lib/graph/builder';

export async function GET() {
  const stats = getGraphStats();
  return NextResponse.json(stats);
}
