import { NextResponse } from 'next/server';
import { PROMETHEUS_URL } from '@/lib/config';
import { findNodeByName, getServiceSubgraph } from '@/lib/graph/query';

interface PrometheusResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}

interface NamespaceMetricsRow {
  namespace: string;
  replicas: number;
  requested: { cpu: string; memory: string };
  limits: { cpu: string; memory: string };
  actualAvg: { cpu: string | null; memory: string | null };
  actualP95: { cpu: string | null; memory: string | null };
  utilization: { cpu: number | null; memory: number | null };
  cost: {
    requestedMonthly: string;
    actualMonthly: string | null;
    potentialSavings: string | null;
  };
}

interface InternalNamespaceMetricsRow extends NamespaceMetricsRow {
  _requestedCpu: number;
  _requestedMem: number;
  _limitCpu: number | null;
  _limitMem: number | null;
  _actualAvgCpu: number | null;
  _actualAvgMem: number | null;
  _actualP95Cpu: number | null;
  _actualP95Mem: number | null;
  _requestedMonthlyCost: number;
  _actualMonthlyCost: number | null;
  _savings: number | null;
}

async function queryPrometheusVector(query: string): Promise<Array<{ metric: Record<string, string>; value: number }>> {
  try {
    // Extract credentials from the raw URL string — avoids the URL constructor
    // percent-encoding the token, which would corrupt the Authorization header.
    // Node 18+ undici also throws if a credentialed URL is passed to fetch().
    const credMatch = PROMETHEUS_URL.match(/^(https?:\/\/)([^:]+):([^@]+)@(.+)$/);
    let cleanBase: string;
    let username = '';
    let password = '';
    if (credMatch) {
      username  = credMatch[2];
      password  = credMatch[3];
      cleanBase = (credMatch[1] + credMatch[4]).replace(/\/$/, '');
    } else {
      cleanBase = PROMETHEUS_URL.replace(/\/$/, '');
    }

    const url = `${cleanBase}/api/v1/query?query=${encodeURIComponent(query)}`;

    const headers: Record<string, string> = {};
    if (username && password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }


    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data: PrometheusResult = await res.json();
    return (data.data?.result || [])
      .map(sample => ({
        metric: sample.metric || {},
        value: parseFloat(sample.value?.[1] || 'NaN'),
      }))
      .filter(sample => Number.isFinite(sample.value));
  } catch (e) {
    console.warn(`Prometheus query failed: ${e}`);
    return [];
  }
}

function toNamespaceMap(
  samples: Array<{ metric: Record<string, string>; value: number }>,
  label = 'namespace'
): Map<string, number> {
  const result = new Map<string, number>();
  for (const sample of samples) {
    const key = sample.metric[label];
    if (!key) continue;
    result.set(key, sample.value);
  }
  return result;
}

function parseCpuToMillicores(cpu: string): number {
  if (cpu.endsWith('m')) return parseFloat(cpu);
  return parseFloat(cpu) * 1000;
}

function parseMemoryToMiB(mem: string): number {
  if (mem.endsWith('Mi')) return parseFloat(mem);
  if (mem.endsWith('Gi')) return parseFloat(mem) * 1024;
  if (mem.endsWith('Ki')) return parseFloat(mem) / 1024;
  return parseFloat(mem) / (1024 * 1024); // bytes to MiB
}

function formatCpuMillicores(cpu: number | null): string | null {
  if (cpu === null) return null;
  return `${cpu >= 100 ? cpu.toFixed(0) : cpu.toFixed(1)}m`;
}

function formatMemoryMiB(mem: number | null): string | null {
  if (mem === null) return null;
  return `${mem >= 100 ? mem.toFixed(0) : mem.toFixed(1)}Mi`;
}

function formatCost(amount: number | null): string | null {
  if (amount === null) return null;
  return `$${amount.toFixed(2)}`;
}

// Cost per core-hour and per GiB-hour (approximate EKS on-demand)
const CPU_COST_PER_CORE_HOUR = 0.031;
const MEM_COST_PER_GIB_HOUR = 0.004;
const HOURS_PER_MONTH = 730;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const node = findNodeByName(name);
  if (!node || node.type !== 'deployment') {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  // minikube cAdvisor stores metrics by pod name (not container name)
  // so we match by pod name prefix: pod=~"api-gateway-.*"
  // also try container label as fallback for standard setups
  const podMatcher = `pod=~"${name}-.*"`;
  const containerMatcher = `container="${name}", image!=""`;
  const matcher = `${podMatcher}`;

  const [avgCpuSamples, avgMemSamples, p95CpuSamples, p95MemSamples, replicaSamples] = await Promise.all([
    queryPrometheusVector(
      `sum by (namespace) (rate(container_cpu_usage_seconds_total{${matcher}}[5m]))`
    ),
    queryPrometheusVector(
      `sum by (namespace) (container_memory_working_set_bytes{${matcher}})`
    ),
    queryPrometheusVector(
      `quantile by (namespace) (0.95, rate(container_cpu_usage_seconds_total{${matcher}}[5m]))`
    ),
    queryPrometheusVector(
      `quantile by (namespace) (0.95, container_memory_working_set_bytes{${matcher}})`
    ),
    queryPrometheusVector(
      `count by (namespace) (count by (namespace, pod) (container_memory_working_set_bytes{${matcher}}))`
    ),
  ]);

  const avgCpuByNamespace = toNamespaceMap(avgCpuSamples);
  const avgMemByNamespace = toNamespaceMap(avgMemSamples);
  const p95CpuByNamespace = toNamespaceMap(p95CpuSamples);
  const p95MemByNamespace = toNamespaceMap(p95MemSamples);
  const replicasByNamespace = toNamespaceMap(replicaSamples);

  const namespaceSet = new Set<string>([
    ...avgCpuByNamespace.keys(),
    ...avgMemByNamespace.keys(),
    ...p95CpuByNamespace.keys(),
    ...p95MemByNamespace.keys(),
    ...replicasByNamespace.keys(),
  ]);

  const fallbackNamespace = node.metadata.namespace || 'unknown';
  if (namespaceSet.size === 0) {
    namespaceSet.add(fallbackNamespace);
  }

  const namespaces = Array.from(namespaceSet).sort((a, b) => a.localeCompare(b));
  const prometheusAvailable = namespaceSet.size > 0 && (
    avgCpuByNamespace.size > 0 ||
    avgMemByNamespace.size > 0 ||
    p95CpuByNamespace.size > 0 ||
    p95MemByNamespace.size > 0
  );

  const requestedCpuPerReplica = node.metadata.cpuRequest
    ? parseCpuToMillicores(node.metadata.cpuRequest)
    : 0;
  const requestedMemPerReplica = node.metadata.memoryRequest
    ? parseMemoryToMiB(node.metadata.memoryRequest)
    : 0;
  const limitCpuPerReplica = node.metadata.cpuLimit
    ? parseCpuToMillicores(node.metadata.cpuLimit)
    : null;
  const limitMemPerReplica = node.metadata.memoryLimit
    ? parseMemoryToMiB(node.metadata.memoryLimit)
    : null;
  const manifestReplicas = node.metadata.replicas || 1;

  const breakdown = namespaces.map<InternalNamespaceMetricsRow>(namespace => {
    const hasActualMetrics =
      avgCpuByNamespace.has(namespace) ||
      avgMemByNamespace.has(namespace) ||
      p95CpuByNamespace.has(namespace) ||
      p95MemByNamespace.has(namespace);

    const replicas = Math.max(
      0,
      Math.round(
        replicasByNamespace.get(namespace) ??
          (namespaces.length === 1 ? manifestReplicas : hasActualMetrics ? 1 : 0)
      )
    );

    const requestedCpu = requestedCpuPerReplica * replicas;
    const requestedMem = requestedMemPerReplica * replicas;
    const limitCpu = limitCpuPerReplica !== null ? limitCpuPerReplica * replicas : null;
    const limitMem = limitMemPerReplica !== null ? limitMemPerReplica * replicas : null;

    const actualAvgCpu = avgCpuByNamespace.has(namespace)
      ? avgCpuByNamespace.get(namespace)! * 1000
      : null;
    const actualAvgMem = avgMemByNamespace.has(namespace)
      ? avgMemByNamespace.get(namespace)! / (1024 * 1024)
      : null;
    const actualP95Cpu = p95CpuByNamespace.has(namespace)
      ? p95CpuByNamespace.get(namespace)! * 1000 * Math.max(replicas, 1)
      : null;
    const actualP95Mem = p95MemByNamespace.has(namespace)
      ? (p95MemByNamespace.get(namespace)! / (1024 * 1024)) * Math.max(replicas, 1)
      : null;

    const requestedMonthlyCost =
      (requestedCpu / 1000) * CPU_COST_PER_CORE_HOUR * HOURS_PER_MONTH +
      (requestedMem / 1024) * MEM_COST_PER_GIB_HOUR * HOURS_PER_MONTH;

    const actualMonthlyCost = actualP95Cpu !== null && actualP95Mem !== null
      ? (actualP95Cpu / 1000) * CPU_COST_PER_CORE_HOUR * HOURS_PER_MONTH +
        (actualP95Mem / 1024) * MEM_COST_PER_GIB_HOUR * HOURS_PER_MONTH
      : null;

    const savings = actualMonthlyCost !== null ? requestedMonthlyCost - actualMonthlyCost : null;

    return {
      namespace,
      replicas,
      requested: {
        cpu: formatCpuMillicores(requestedCpu) || '0m',
        memory: formatMemoryMiB(requestedMem) || '0Mi',
      },
      limits: {
        cpu: formatCpuMillicores(limitCpu) || 'not set',
        memory: formatMemoryMiB(limitMem) || 'not set',
      },
      actualAvg: {
        cpu: formatCpuMillicores(actualAvgCpu),
        memory: formatMemoryMiB(actualAvgMem),
      },
      actualP95: {
        cpu: formatCpuMillicores(actualP95Cpu),
        memory: formatMemoryMiB(actualP95Mem),
      },
      utilization: {
        cpu: actualAvgCpu !== null && requestedCpu > 0
          ? Math.round((actualAvgCpu / requestedCpu) * 100)
          : null,
        memory: actualAvgMem !== null && requestedMem > 0
          ? Math.round((actualAvgMem / requestedMem) * 100)
          : null,
      },
      cost: {
        requestedMonthly: formatCost(requestedMonthlyCost) || '$0.00',
        actualMonthly: formatCost(actualMonthlyCost),
        potentialSavings: formatCost(savings),
      },
      _requestedCpu: requestedCpu,
      _requestedMem: requestedMem,
      _limitCpu: limitCpu,
      _limitMem: limitMem,
      _actualAvgCpu: actualAvgCpu,
      _actualAvgMem: actualAvgMem,
      _actualP95Cpu: actualP95Cpu,
      _actualP95Mem: actualP95Mem,
      _requestedMonthlyCost: requestedMonthlyCost,
      _actualMonthlyCost: actualMonthlyCost,
      _savings: savings,
    };
  });

  const totals = breakdown.reduce(
    (acc, row) => ({
      replicas: acc.replicas + row.replicas,
      requestedCpu: acc.requestedCpu + row._requestedCpu,
      requestedMem: acc.requestedMem + row._requestedMem,
      limitCpu: row._limitCpu === null || acc.limitCpu === null ? null : acc.limitCpu + row._limitCpu,
      limitMem: row._limitMem === null || acc.limitMem === null ? null : acc.limitMem + row._limitMem,
      actualAvgCpu: acc.actualAvgCpu + (row._actualAvgCpu || 0),
      actualAvgMem: acc.actualAvgMem + (row._actualAvgMem || 0),
      actualP95Cpu: acc.actualP95Cpu + (row._actualP95Cpu || 0),
      actualP95Mem: acc.actualP95Mem + (row._actualP95Mem || 0),
      requestedMonthlyCost: acc.requestedMonthlyCost + row._requestedMonthlyCost,
      actualMonthlyCost: acc.actualMonthlyCost + (row._actualMonthlyCost || 0),
      actualMonthlyCostCount: acc.actualMonthlyCostCount + (row._actualMonthlyCost !== null ? 1 : 0),
      savings: acc.savings + (row._savings || 0),
      savingsCount: acc.savingsCount + (row._savings !== null ? 1 : 0),
    }),
    {
      replicas: 0,
      requestedCpu: 0,
      requestedMem: 0,
      limitCpu: limitCpuPerReplica !== null ? 0 : null as number | null,
      limitMem: limitMemPerReplica !== null ? 0 : null as number | null,
      actualAvgCpu: 0,
      actualAvgMem: 0,
      actualP95Cpu: 0,
      actualP95Mem: 0,
      requestedMonthlyCost: 0,
      actualMonthlyCost: 0,
      actualMonthlyCostCount: 0,
      savings: 0,
      savingsCount: 0,
    }
  );

  const namespaceRows: NamespaceMetricsRow[] = breakdown.map(row => ({
    namespace: row.namespace,
    replicas: row.replicas,
    requested: row.requested,
    limits: row.limits,
    actualAvg: row.actualAvg,
    actualP95: row.actualP95,
    utilization: row.utilization,
    cost: row.cost,
  }));

  // Query infrastructure costs (databases, kafka, redis, rabbitmq)
  const subgraph = getServiceSubgraph(name, 1);
  const dbNodes = subgraph.nodes.filter(n => n.type === 'database');
  const databases: Array<{ name: string; type: string; avgCpu: string | null; avgMem: string | null; monthlyCost: string | null }> = [];

  // Map infra names to their Prometheus query patterns
  const infraMatchers: Record<string, string> = {};
  for (const db of dbNodes) {
    const n = db.name;
    if (n === 'kafka') {
      infraMatchers[n] = `container=~"kafka.*", pod=~"kafka.*"`;
    } else if (n === 'rabbitmq') {
      infraMatchers[n] = `container="rabbitmq", pod=~"rabbitmq.*"`;
    } else if (n.startsWith('redis')) {
      infraMatchers[n] = `container=~"redis.*", pod=~"${n}.*"`;
    } else if (n.endsWith('-db') || n.startsWith('fixtures')) {
      infraMatchers[n] = `container="postgres", pod=~"${n}.*"`;
    } else {
      // Regular DB from db-secret: pod pattern is {name}-db{N}-0
      infraMatchers[n] = `container="postgres", pod=~"${n}-db.*"`;
    }
  }

  // Query all in parallel
  const infraResults = await Promise.all(
    Object.entries(infraMatchers).map(async ([infraName, matcher]) => {
      const [cpuSamples, memSamples] = await Promise.all([
        queryPrometheusVector(`sum(rate(container_cpu_usage_seconds_total{${matcher}}[5m]))`),
        queryPrometheusVector(`sum(container_memory_working_set_bytes{${matcher}})`),
      ]);
      const avgCpu = cpuSamples[0]?.value ? cpuSamples[0].value * 1000 : null;
      const avgMem = memSamples[0]?.value ? memSamples[0].value / (1024 * 1024) : null;
      let monthlyCost: number | null = null;
      if (avgCpu !== null && avgMem !== null) {
        monthlyCost =
          (avgCpu / 1000) * CPU_COST_PER_CORE_HOUR * HOURS_PER_MONTH +
          (avgMem / 1024) * MEM_COST_PER_GIB_HOUR * HOURS_PER_MONTH;
      }
      const isInfra = ['kafka', 'rabbitmq'].includes(infraName) || infraName.startsWith('redis');
      return {
        name: infraName,
        type: isInfra ? 'infra' : 'database',
        avgCpu: formatCpuMillicores(avgCpu),
        avgMem: formatMemoryMiB(avgMem),
        monthlyCost: formatCost(monthlyCost),
      };
    })
  );

  // Only include items that have actual data
  databases.push(...infraResults.filter(r => r.avgCpu !== null || r.avgMem !== null));

  return NextResponse.json({
    prometheusAvailable,
    namespaceCount: namespaces.length,
    namespaces: namespaceRows,
    databases,
    replicas: totals.replicas || manifestReplicas,
    requested: {
      cpu: formatCpuMillicores(totals.requestedCpu) || '0m',
      memory: formatMemoryMiB(totals.requestedMem) || '0Mi',
    },
    limits: {
      cpu: formatCpuMillicores(totals.limitCpu) || 'not set',
      memory: formatMemoryMiB(totals.limitMem) || 'not set',
    },
    actualAvg: {
      cpu: formatCpuMillicores(prometheusAvailable ? totals.actualAvgCpu : null),
      memory: formatMemoryMiB(prometheusAvailable ? totals.actualAvgMem : null),
    },
    actualP95: {
      cpu: formatCpuMillicores(totals.actualMonthlyCostCount > 0 ? totals.actualP95Cpu : null),
      memory: formatMemoryMiB(totals.actualMonthlyCostCount > 0 ? totals.actualP95Mem : null),
    },
    utilization: {
      cpu:
        prometheusAvailable && totals.requestedCpu > 0
          ? Math.round((totals.actualAvgCpu / totals.requestedCpu) * 100)
          : null,
      memory:
        prometheusAvailable && totals.requestedMem > 0
          ? Math.round((totals.actualAvgMem / totals.requestedMem) * 100)
          : null,
    },
    cost: {
      requestedMonthly: formatCost(totals.requestedMonthlyCost) || '$0.00',
      actualMonthly: totals.actualMonthlyCostCount > 0 ? formatCost(totals.actualMonthlyCost) : null,
      potentialSavings: totals.savingsCount > 0 ? formatCost(totals.savings) : null,
    },
    // Calculate total potential savings including DB rightsizing and replica optimization
    totalPotentialSavings: (() => {
      let savings = 0;

      // 1. Service over-provisioning savings
      if (totals.savingsCount > 0 && totals.savings > 0) {
        savings += totals.savings;
      }

      // 2. Infra rightsizing: estimate savings from all infra (DB, kafka, rabbitmq, redis)
      // Assume typical over-provisioning: infra usually runs at ~30% utilization
      // Savings = 50% of actual infra cost (could be rightsized to half)
      for (const db of databases) {
        if (!db.monthlyCost) continue;
        const actualCost = parseFloat(db.monthlyCost.replace('$', ''));
        // Estimate savings: infra typically over-provisioned by ~50%
        savings += actualCost * 0.5;
      }

      // 3. Replica optimization: if avg CPU per replica < 10m, suggest halving replicas
      const replicaCount = totals.replicas || manifestReplicas;
      if (replicaCount > 2 && totals.actualAvgCpu > 0) {
        const avgCpuPerReplica = totals.actualAvgCpu / replicaCount;
        if (avgCpuPerReplica < 10) {
          // Could run with half the replicas
          const reducedReplicas = Math.max(2, Math.ceil(replicaCount / 2));
          const savedReplicas = replicaCount - reducedReplicas;
          const perReplicaCost =
            (requestedCpuPerReplica / 1000) * CPU_COST_PER_CORE_HOUR * HOURS_PER_MONTH +
            (requestedMemPerReplica / 1024) * MEM_COST_PER_GIB_HOUR * HOURS_PER_MONTH;
          savings += savedReplicas * perReplicaCost;
        }
      }

      return savings > 0 ? formatCost(savings) : null;
    })(),
    infraCostMonthly: (() => {
      const allInfraCost = databases.reduce((sum, db) => {
        if (!db.monthlyCost) return sum;
        return sum + parseFloat(db.monthlyCost.replace('$', ''));
      }, 0);
      return allInfraCost > 0 ? formatCost(allInfraCost) : null;
    })(),
    totalCostWithInfra: (() => {
      const allInfraCost = databases.reduce((sum, db) => {
        if (!db.monthlyCost) return sum;
        return sum + parseFloat(db.monthlyCost.replace('$', ''));
      }, 0);
      const serviceCost = totals.actualMonthlyCostCount > 0 ? totals.actualMonthlyCost : totals.requestedMonthlyCost;
      return formatCost(serviceCost + allInfraCost);
    })(),
  });
}