import { NextResponse } from 'next/server';
import { getUsage } from '@/lib/ai/usage-tracker';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const usage = getUsage(name);
  if (!usage) {
    return NextResponse.json({ error: 'No usage data for this service' }, { status: 404 });
  }
  return NextResponse.json(usage);
}