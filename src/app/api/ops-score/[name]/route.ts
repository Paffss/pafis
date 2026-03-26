import { NextRequest, NextResponse } from 'next/server';
import { findNodeByName } from '@/lib/graph/query';
import { getGraph } from '@/lib/graph/builder';

export const dynamic = 'force-dynamic';

export interface OpsCheck {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
  category: 'reliability' | 'observability' | 'delivery' | 'security';
}

export interface OpsScoreResult {
  score: number;
  maxScore: number;
  grade: string;
  checks: OpsCheck[];
}

function getGrade(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const node = findNodeByName(name);
  if (!node || node.type !== 'deployment') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const graph = getGraph();
  const m = node.metadata;

  // Check if ServiceMonitor exists
  const hasSM = graph.edges.some(
    e => (e.target === `deploy:${name}` || e.target === `svc:${name}`) && e.type === 'monitors'
  );

  // Parse image tag
  const imageTag = m.image?.split(':').pop() || '';
  const isSemVer = /^v?\d+\.\d+/.test(imageTag) && imageTag !== 'latest';

  const checks: OpsCheck[] = [
    // Reliability
    {
      id: 'resource-limits',
      label: 'Resource Limits',
      passed: !!(m.cpuLimit && m.memoryLimit),
      points: !!(m.cpuLimit && m.memoryLimit) ? 25 : 0,
      maxPoints: 25,
      detail: m.cpuLimit && m.memoryLimit
        ? `CPU: ${m.cpuLimit}, Mem: ${m.memoryLimit}`
        : 'No CPU or memory limits — pod can consume unbounded resources',
      category: 'reliability',
    },
    {
      id: 'liveness-probe',
      label: 'Liveness Probe',
      passed: !!m.hasLivenessProbe,
      points: m.hasLivenessProbe ? 15 : 0,
      maxPoints: 15,
      detail: m.hasLivenessProbe
        ? 'Liveness probe configured'
        : 'No liveness probe — Kubernetes cannot detect if the app is stuck',
      category: 'reliability',
    },
    {
      id: 'readiness-probe',
      label: 'Readiness Probe',
      passed: !!m.hasReadinessProbe,
      points: m.hasReadinessProbe ? 10 : 0,
      maxPoints: 10,
      detail: m.hasReadinessProbe
        ? 'Readiness probe configured'
        : 'No readiness probe — traffic may be sent before app is ready',
      category: 'reliability',
    },
    {
      id: 'high-availability',
      label: 'High Availability',
      passed: (m.replicas ?? 1) > 1,
      points: (m.replicas ?? 1) > 1 ? 15 : 0,
      maxPoints: 15,
      detail: (m.replicas ?? 1) > 1
        ? `${m.replicas} replicas — resilient to single pod failure`
        : 'Single replica — any restart causes downtime',
      category: 'reliability',
    },
    // Observability
    {
      id: 'service-monitor',
      label: 'Metrics Scraping',
      passed: hasSM,
      points: hasSM ? 15 : 0,
      maxPoints: 15,
      detail: hasSM
        ? 'ServiceMonitor configured — Prometheus scraping active'
        : 'No ServiceMonitor — metrics not scraped by Prometheus',
      category: 'observability',
    },
    {
      id: 'owner-team',
      label: 'Owner Team',
      passed: !!m.ownerTeam,
      points: m.ownerTeam ? 10 : 0,
      maxPoints: 10,
      detail: m.ownerTeam
        ? `Owned by ${m.ownerTeam}`
        : 'No owner_team label — nobody to page when this breaks',
      category: 'observability',
    },
    // Delivery
    {
      id: 'image-tag',
      label: 'Image Tag',
      passed: isSemVer,
      points: isSemVer ? 10 : 0,
      maxPoints: 10,
      detail: isSemVer
        ? `Using versioned tag: ${imageTag}`
        : imageTag === 'latest'
          ? 'Using :latest — not reproducible, risky in production'
          : `Tag "${imageTag}" does not follow SemVer`,
      category: 'delivery',
    },
  ];

  const score    = checks.reduce((s, c) => s + c.points, 0);
  const maxScore = checks.reduce((s, c) => s + c.maxPoints, 0);

  return NextResponse.json({
    score,
    maxScore,
    grade: getGrade(Math.round((score / maxScore) * 100)),
    checks,
  });
}