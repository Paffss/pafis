import { NextRequest, NextResponse } from 'next/server';
import { findNodeByName } from '@/lib/graph/query';
import yaml from 'js-yaml';

export const dynamic = 'force-dynamic';

export interface LabelCheck {
  key: string;
  value: string | null;
  present: boolean;
  required: boolean;
  description: string;
}

export interface LabelResult {
  compliant: boolean;
  complianceRate: number;
  checks: LabelCheck[];
  allLabels: Record<string, string>;
}

const REQUIRED_LABELS: { key: string; description: string }[] = [
  { key: 'app',         description: 'Application name identifier' },
  { key: 'owner_team',  description: 'Team responsible for this service' },
  { key: 'environment', description: 'Deployment environment (production/staging/qa/dev)' },
];

const RECOMMENDED_LABELS: { key: string; description: string }[] = [
  { key: 'version',     description: 'Application version' },
  { key: 'framework',   description: 'Technology framework (express, spring, etc.)' },
  { key: 'tech',        description: 'Primary language/runtime' },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const node = findNodeByName(name);
  if (!node || node.type !== 'deployment') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Parse raw labels from YAML
  let allLabels: Record<string, string> = {};
  try {
    const doc = yaml.load(node.rawYaml || '') as {
      metadata?: { labels?: Record<string, string> };
      spec?: { template?: { metadata?: { labels?: Record<string, string> } } };
    };
    allLabels = {
      ...doc?.metadata?.labels,
      ...doc?.spec?.template?.metadata?.labels,
    };
  } catch { /* use empty */ }

  const checks: LabelCheck[] = [
    ...REQUIRED_LABELS.map(l => ({
      key:         l.key,
      value:       allLabels[l.key] || null,
      present:     !!allLabels[l.key],
      required:    true,
      description: l.description,
    })),
    ...RECOMMENDED_LABELS.map(l => ({
      key:         l.key,
      value:       allLabels[l.key] || null,
      present:     !!allLabels[l.key],
      required:    false,
      description: l.description,
    })),
  ];

  const requiredPassed = checks.filter(c => c.required && c.present).length;
  const requiredTotal  = checks.filter(c => c.required).length;
  const complianceRate = Math.round((requiredPassed / requiredTotal) * 100);

  return NextResponse.json({
    compliant:      complianceRate === 100,
    complianceRate,
    checks,
    allLabels,
  });
}