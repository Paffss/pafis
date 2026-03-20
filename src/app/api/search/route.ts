import { NextRequest, NextResponse } from 'next/server';
import { searchServices } from '@/lib/graph/query';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json([]);
  
  const results = searchServices(query, 30);
  return NextResponse.json(results);
}
