import {
  parseDeployments,
  parseServices,
  parseIngresses,
  parseHelmCharts,
  parseServiceMonitors,
  parseNetworkPolicies,
  parsePVCs,
} from '../parser';
import {
  InfraGraph,
  GraphNode,
  GraphEdge,
  FAMILY_SUFFIXES,
} from './types';

let cachedGraph: InfraGraph | null = null;

export function getGraph(): InfraGraph {
  if (cachedGraph) return cachedGraph;
  cachedGraph = buildGraph();
  return cachedGraph;
}

function buildGraph(): InfraGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();

  const addEdge = (edge: GraphEdge) => {
    edges.push(edge);
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    if (!reverseAdjacency.has(edge.target)) reverseAdjacency.set(edge.target, new Set());
    reverseAdjacency.get(edge.target)!.add(edge.source);
  };

  console.time('parseDeployments');
  const deployments = parseDeployments();
  console.timeEnd('parseDeployments');

  console.time('parseServices');
  const services = parseServices();
  console.timeEnd('parseServices');

  console.time('parseIngresses');
  const ingresses = parseIngresses();
  console.timeEnd('parseIngresses');

  console.time('parseHelmCharts');
  const helmCharts = parseHelmCharts();
  console.timeEnd('parseHelmCharts');

  console.time('parseServiceMonitors');
  const serviceMonitors = parseServiceMonitors();
  console.timeEnd('parseServiceMonitors');

  // 1. Add deployment nodes
  for (const dep of deployments) {
    const node = dep.node;

    // Determine family
    let family = node.name;
    for (const suffix of FAMILY_SUFFIXES) {
      if (node.name.endsWith(suffix)) {
        family = node.name.slice(0, -suffix.length);
        break;
      }
    }
    // Handle provider-specific consumers like casino-game-rounds-playgo-consumer
    if (node.name.match(/-\w+-consumer$/)) {
      const parts = node.name.split('-');
      parts.pop(); // remove "consumer"
      parts.pop(); // remove provider name
      family = parts.join('-');
    }
    node.metadata.family = family;

    nodes.set(node.id, node);

    // 2. Create configmap nodes + edges
    for (const [cmName, keys] of dep.configMapRefs) {
      const cmId = `cm:${cmName}`;
      if (!nodes.has(cmId)) {
        nodes.set(cmId, {
          id: cmId,
          type: 'configmap',
          name: cmName,
          metadata: {},
        });
      }
      addEdge({
        source: node.id,
        target: cmId,
        type: 'uses-configmap',
        label: keys.length > 3 ? `${keys.length} keys` : keys.join(', '),
      });
    }

    // 3. Create secret nodes + edges
    for (const secretName of dep.secretRefs) {
      const secId = `secret:${secretName}`;
      if (!nodes.has(secId)) {
        nodes.set(secId, {
          id: secId,
          type: 'secret',
          name: secretName,
          metadata: {},
        });
      }
      addEdge({
        source: node.id,
        target: secId,
        type: 'uses-secret',
      });
    }

    // 4. Create database nodes from db secrets
    for (const dbSecret of dep.dbSecrets) {
      const dbName = dbSecret.replace(/-secret$/, '').replace(/-db$/, '');
      const dbId = `db:${dbName}`;
      if (!nodes.has(dbId)) {
        nodes.set(dbId, {
          id: dbId,
          type: 'database',
          name: dbName,
          metadata: {},
        });
      }
      addEdge({
        source: node.id,
        target: dbId,
        type: 'uses-database',
      });
    }
  }

  // 4b. Add service dependency edges from CONNECTION_CHECKER_SERVICES
  for (const dep of deployments) {
    for (const sDep of dep.serviceDeps) {
      // Map known infra names to proper node types
      let targetId: string | null = null;
      if (sDep.name.startsWith('redis')) {
        targetId = `infra:${sDep.name}`;
        if (!nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, type: 'database', name: sDep.name, metadata: {} });
        }
      } else if (sDep.name === 'kafka') {
        targetId = 'infra:kafka';
        if (!nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, type: 'database', name: 'kafka', metadata: {} });
        }
      } else if (sDep.name === 'rabbitmq') {
        targetId = 'infra:rabbitmq';
        if (!nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, type: 'database', name: 'rabbitmq', metadata: {} });
        }
      } else if (sDep.name.endsWith('-db') || sDep.name.startsWith('fixtures')) {
        targetId = `infra:${sDep.name}`;
        if (!nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, type: 'database', name: sDep.name, metadata: {} });
        }
      } else {
        // Regular service dependency
        targetId = nodes.has(`deploy:${sDep.name}`) ? `deploy:${sDep.name}` : null;
      }

      if (targetId && dep.node.id !== targetId) {
        addEdge({
          source: dep.node.id,
          target: targetId,
          type: 'network-allows',
          label: `:${sDep.port}`,
        });
      }
    }
  }

  // 5. Add service nodes + link to deployments via selector
  for (const svc of services) {
    nodes.set(svc.node.id, svc.node);
    const deployId = `deploy:${svc.selectorName}`;
    if (nodes.has(deployId)) {
      addEdge({
        source: svc.node.id,
        target: deployId,
        type: 'exposes',
      });
    }
  }

  // 6. Add ingress data to nodes + link to services
  for (const [svcName, ingData] of ingresses) {
    const ingId = `ing:${svcName}`;
    nodes.set(ingId, {
      id: ingId,
      type: 'ingress',
      name: svcName,
      metadata: {
        hosts: ingData.hosts,
        paths: ingData.paths,
      },
    });

    const svcId = `svc:${svcName}`;
    if (nodes.has(svcId)) {
      addEdge({
        source: ingId,
        target: svcId,
        type: 'routes-to',
      });
    }
  }

  // 7. Add helm chart nodes + dependency edges
  const helmNodeMap = new Map<string, string>(); // chart name -> node id
  for (const chart of helmCharts) {
    nodes.set(chart.node.id, chart.node);
    helmNodeMap.set(chart.node.name, chart.node.id);
  }
  for (const chart of helmCharts) {
    for (const depName of chart.dependencyNames) {
      const targetId = helmNodeMap.get(depName);
      if (targetId) {
        addEdge({
          source: chart.node.id,
          target: targetId,
          type: 'helm-depends',
        });
      }
    }
  }

  // 8. Add service monitor links
  for (const sm of serviceMonitors) {
    const svcId = `svc:${sm.targetServiceName}`;
    const deployId = `deploy:${sm.targetServiceName}`;
    const smId = `sm:${sm.name}`;

    nodes.set(smId, {
      id: smId,
      type: 'servicemonitor',
      name: sm.name,
      metadata: {},
    });

    if (nodes.has(svcId)) {
      addEdge({ source: smId, target: svcId, type: 'monitors' });
    } else if (nodes.has(deployId)) {
      addEdge({ source: smId, target: deployId, type: 'monitors' });
    }
  }

  // 9. Network policy edges (source -> destination = "source can call destination")
  console.time('parseNetworkPolicies');
  const netPolicies = parseNetworkPolicies();
  console.timeEnd('parseNetworkPolicies');

  for (const dep of netPolicies) {
    // Skip ingress-nginx as source — already covered by ingress nodes
    if (dep.source === 'ingress-nginx') continue;

    // Find source and destination nodes (prefer deploy, then svc)
    const sourceId = nodes.has(`deploy:${dep.source}`) ? `deploy:${dep.source}` :
                     nodes.has(`svc:${dep.source}`) ? `svc:${dep.source}` : null;
    const destId = nodes.has(`deploy:${dep.destination}`) ? `deploy:${dep.destination}` :
                   nodes.has(`svc:${dep.destination}`) ? `svc:${dep.destination}` :
                   nodes.has(`db:${dep.destination}`) ? `db:${dep.destination}` : null;

    if (sourceId && destId && sourceId !== destId) {
      addEdge({
        source: sourceId,
        target: destId,
        type: 'network-allows',
        label: `:${dep.port}`,
      });
    }
  }

  // 10. Add PVC nodes + link to deployments via name heuristic
  console.time('parsePVCs');
  const pvcs = parsePVCs();
  console.timeEnd('parsePVCs');

  for (const pvc of pvcs) {
    nodes.set(pvc.node.id, pvc.node);
    // Try to link PVC to its owner deployment
    const deployId = `deploy:${pvc.ownerDeploymentHint}`;
    if (nodes.has(deployId)) {
      addEdge({
        source: deployId,
        target: pvc.node.id,
        type: 'uses-pvc',
        label: pvc.node.metadata.pvcStorage,
      });
    }
  }

  // 11. Family member edges
  const families = new Map<string, string[]>();
  for (const dep of deployments) {
    const family = dep.node.metadata.family!;
    const members = families.get(family) || [];
    members.push(dep.node.id);
    families.set(family, members);
  }
  for (const [family, members] of families) {
    if (members.length < 2) continue;
    // Find the "base" member (shortest name, or exact match to family)
    const base = members.find(m => m === `deploy:${family}`) || members[0];
    for (const member of members) {
      if (member !== base) {
        addEdge({
          source: base,
          target: member,
          type: 'family-member',
        });
      }
    }
  }

  const graph: InfraGraph = { nodes, edges, adjacency, reverseAdjacency };

  console.log(
    `Graph built: ${nodes.size} nodes, ${edges.length} edges`
  );

  return graph;
}

// Stats for the dashboard
export function getGraphStats() {
  const graph = getGraph();
  const stats = {
    totalNodes: graph.nodes.size,
    deployments: 0,
    services: 0,
    ingresses: 0,
    helmCharts: 0,
    jobs: 0,
    configmaps: 0,
    secrets: 0,
    databases: 0,
    serviceMonitors: 0,
    networkPolicies: 0,
    pvcs: 0,
    loadBalancers: 0,
    pvcCostMonthly: 0,
    lbCostMonthly: 0,
    edges: graph.edges.length,
    teamDistribution: {} as Record<string, number>,
    noLimits: 0,
    singleReplica: 0,
    latestTag: 0,
    noLivenessProbe: 0,
    noOwnerTeam: 0,
    environments: 0,
    environmentDistribution: {} as Record<string, number>,
  };

  for (const node of graph.nodes.values()) {
    switch (node.type) {
      case 'deployment':
        stats.deployments++;
        if (node.metadata.ownerTeam) {
          stats.teamDistribution[node.metadata.ownerTeam] =
            (stats.teamDistribution[node.metadata.ownerTeam] || 0) + 1;
        } else {
          stats.noOwnerTeam++;
          stats.teamDistribution['unknown'] = (stats.teamDistribution['unknown'] || 0) + 1;
        }
        if (!node.metadata.cpuLimit && !node.metadata.memoryLimit) stats.noLimits++;
        if (node.metadata.replicas === 1) stats.singleReplica++;
        if (node.metadata.image?.endsWith(':latest')) stats.latestTag++;
        if (!node.metadata.hasLivenessProbe) stats.noLivenessProbe++;
        if (node.metadata.image?.endsWith(':latest')) stats.latestTag++;
        if (!node.metadata.hasLivenessProbe) stats.noLivenessProbe++;
        // Environment distribution
        const env = node.metadata.environment || 'unknown';
        stats.environmentDistribution[env] = (stats.environmentDistribution[env] || 0) + 1;
        break;
      case 'service':
        stats.services++;
        break;
      case 'ingress':
        stats.ingresses++;
        break;
      case 'helm-chart': stats.helmCharts++; break;
      case 'configmap': stats.configmaps++; break;
      case 'secret': stats.secrets++; break;
      case 'database': stats.databases++; break;
      case 'servicemonitor': stats.serviceMonitors++; break;
      case 'pvc': stats.pvcs++; break;
    }
  }

  // Count network policy edges
  stats.networkPolicies = graph.edges.filter(e => e.type === 'network-allows').length;

  // Tally LoadBalancer and PVC costs
  for (const node of graph.nodes.values()) {
    if (node.type === 'service' && node.metadata.loadBalancerCostMonthly) {
      stats.loadBalancers++;
      stats.lbCostMonthly += node.metadata.loadBalancerCostMonthly;
    }
    if (node.type === 'pvc' && node.metadata.pvcCostMonthly) {
      stats.pvcCostMonthly += node.metadata.pvcCostMonthly;
    }
  }

  // Derive environment count from deployment metadata
  stats.environments = Object.keys(stats.environmentDistribution).filter(e => e !== 'unknown').length;

  return stats;
}