import { NextResponse } from 'next/server';
import { getAllUsage, getTotalUsage } from '@/lib/ai/usage-tracker';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    summary: getTotalUsage(),
    services: getAllUsage(),
  });
}