import { NextResponse } from 'next/server';
import { getGraph } from '@/lib/graph/builder';

export interface UnusedItem {
  name: string;
  type: string;
  reason: string;
  severity: 'warning' | 'info';
}

export async function GET() {
  const graph = getGraph();
  const unused: UnusedItem[] = [];

  // Build lookup sets
  const deploymentNames = new Set<string>();
  const serviceNames    = new Set<string>();
  const helmNames       = new Set<string>();
  const configmapNames  = new Set<string>();
  const smNames         = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.type === 'deployment')     deploymentNames.add(node.name);
    if (node.type === 'service')        serviceNames.add(node.name);
    if (node.type === 'helm-chart')     helmNames.add(node.name);
    if (node.type === 'configmap')      configmapNames.add(node.name);
    if (node.type === 'servicemonitor') smNames.add(node.name);
  }

  // Build edge lookup: what does each node connect to?
  const connectedTo   = new Map<string, Set<string>>(); // node -> targets
  const connectedFrom = new Map<string, Set<string>>(); // node -> sources

  for (const edge of graph.edges) {
    if (!connectedTo.has(edge.source))   connectedTo.set(edge.source, new Set());
    if (!connectedFrom.has(edge.target)) connectedFrom.set(edge.target, new Set());
    connectedTo.get(edge.source)!.add(edge.target);
    connectedFrom.get(edge.target)!.add(edge.source);
  }

  // 1. Deployments with no Service pointing at them
  for (const node of graph.nodes.values()) {
    if (node.type !== 'deployment') continue;
    const id = node.id;
    const sources = connectedFrom.get(id) || new Set();
    const hasService = [...sources].some(s => s.startsWith('svc:'));
    if (!hasService) {
      unused.push({
        name:     node.name,
        type:     'Deployment',
        reason:   'No Service routes traffic to this deployment',
        severity: 'warning',
      });
    }
  }

  // 2. Services with no Deployment backing them
  for (const node of graph.nodes.values()) {
    if (node.type !== 'service') continue;
    const targets = connectedTo.get(node.id) || new Set();
    const hasDeployment = [...targets].some(t => t.startsWith('deploy:'));
    if (!hasDeployment) {
      unused.push({
        name:     node.name,
        type:     'Service',
        reason:   'No Deployment matches this service selector',
        severity: 'warning',
      });
    }
  }

  // 3. Helm charts not referenced by any deployment
  for (const node of graph.nodes.values()) {
    if (node.type !== 'helm-chart') continue;
    const targets = connectedTo.get(node.id) || new Set();
    const sources = connectedFrom.get(node.id) || new Set();
    if (targets.size === 0 && sources.size === 0) {
      unused.push({
        name:     node.name,
        type:     'Helm Chart',
        reason:   'Chart has no connections to any deployment or service',
        severity: 'info',
      });
    }
  }

  // 4. ConfigMaps not mounted by any deployment
  for (const node of graph.nodes.values()) {
    if (node.type !== 'configmap') continue;
    const sources = connectedFrom.get(node.id) || new Set();
    if (sources.size === 0) {
      unused.push({
        name:     node.name,
        type:     'ConfigMap',
        reason:   'Not mounted or referenced by any deployment',
        severity: 'info',
      });
    }
  }

  // 5. ServiceMonitors with no matching deployment/service
  for (const node of graph.nodes.values()) {
    if (node.type !== 'servicemonitor') continue;
    const targets = connectedTo.get(node.id) || new Set();
    if (targets.size === 0) {
      unused.push({
        name:     node.name,
        type:     'ServiceMonitor',
        reason:   'No matching deployment or service found for this monitor',
        severity: 'warning',
      });
    }
  }

  // Sort: warnings first, then by type, then by name
  unused.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'warning' ? -1 : 1;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  const summary = {
    total:        unused.length,
    warnings:     unused.filter(u => u.severity === 'warning').length,
    info:         unused.filter(u => u.severity === 'info').length,
    byType: {
      deployments:     unused.filter(u => u.type === 'Deployment').length,
      services:        unused.filter(u => u.type === 'Service').length,
      helmCharts:      unused.filter(u => u.type === 'Helm Chart').length,
      configmaps:      unused.filter(u => u.type === 'ConfigMap').length,
      serviceMonitors: unused.filter(u => u.type === 'ServiceMonitor').length,
    },
  };

  return NextResponse.json({ summary, items: unused });
}