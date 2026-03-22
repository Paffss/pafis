import { NextResponse } from 'next/server';
import { getGraph } from '@/lib/graph/builder';

const CPU_COST_PER_CORE_HOUR  = 0.031;
const MEM_COST_PER_GIB_HOUR   = 0.004;
const HOURS_PER_MONTH         = 730;

function parseCpu(cpu: string): number {
  if (!cpu) return 0;
  if (cpu.endsWith('m')) return parseFloat(cpu) / 1000;
  return parseFloat(cpu);
}

function parseMem(mem: string): number {
  if (!mem) return 0;
  if (mem.endsWith('Mi')) return parseFloat(mem) / 1024;
  if (mem.endsWith('Gi')) return parseFloat(mem);
  if (mem.endsWith('Ki')) return parseFloat(mem) / (1024 * 1024);
  return parseFloat(mem) / (1024 * 1024 * 1024);
}

export async function GET() {
  const graph = getGraph();
  const services: Array<{
    name: string;
    team: string;
    replicas: number;
    cpuRequest: string;
    memRequest: string;
    monthlyCost: number;
    cpuCost: number;
    memCost: number;
  }> = [];

  for (const node of graph.nodes.values()) {
    if (node.type !== 'deployment') continue;
    const replicas = (node.metadata.replicas as number) ?? 1;
    const cpuCores = parseCpu(node.metadata.cpuRequest as string ?? '0');
    const memGiB   = parseMem(node.metadata.memoryRequest as string ?? '0');

    const cpuCost  = cpuCores * CPU_COST_PER_CORE_HOUR * HOURS_PER_MONTH * replicas;
    const memCost  = memGiB   * MEM_COST_PER_GIB_HOUR  * HOURS_PER_MONTH * replicas;
    const total    = cpuCost + memCost;

    if (total === 0) continue;

    services.push({
      name: node.name,
      team: (node.metadata.ownerTeam as string) || 'unknown',
      replicas,
      cpuRequest: (node.metadata.cpuRequest as string) || '0',
      memRequest: (node.metadata.memoryRequest as string) || '0',
      monthlyCost: Math.round(total * 100) / 100,
      cpuCost: Math.round(cpuCost * 100) / 100,
      memCost: Math.round(memCost * 100) / 100,
    });
  }

  services.sort((a, b) => b.monthlyCost - a.monthlyCost);

  const total = services.reduce((sum, s) => sum + s.monthlyCost, 0);

  return NextResponse.json({
    topServices: services.slice(0, 10),
    totalMonthlyCost: Math.round(total * 100) / 100,
    serviceCount: services.length,
  });
}