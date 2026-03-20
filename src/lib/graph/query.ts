import Fuse from 'fuse.js';
import { getGraph } from './builder';
import {
  GraphNode,
  GraphEdge,
  Subgraph,
  SHARED_CONFIGMAPS,
  SHARED_SECRETS,
} from './types';

export function findNodeByName(name: string): GraphNode | undefined {
  const graph = getGraph();
  // Try exact matches in priority order
  for (const prefix of ['deploy', 'svc', 'helm', 'ing', 'cm', 'secret', 'db', 'sm']) {
    const id = `${prefix}:${name}`;
    if (graph.nodes.has(id)) return graph.nodes.get(id);
  }
  return undefined;
}

export function getServiceSubgraph(name: string, depth = 2): Subgraph {
  const graph = getGraph();
  const visited = new Set<string>();
  const subNodes: GraphNode[] = [];
  const subEdges: GraphEdge[] = [];

  // Find the starting node - prefer deployment
  let startId = `deploy:${name}`;
  if (!graph.nodes.has(startId)) {
    startId = `svc:${name}`;
    if (!graph.nodes.has(startId)) {
      startId = `helm:${name}`;
      if (!graph.nodes.has(startId)) {
        return { nodes: [], edges: [] };
      }
    }
  }

  // Build edge type lookup for fast checks
  const edgeTypeMap = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const key = `${edge.source}|${edge.target}`;
    if (!edgeTypeMap.has(key)) edgeTypeMap.set(key, new Set());
    edgeTypeMap.get(key)!.add(edge.type);
  }
  const hasEdgeType = (src: string, tgt: string, type: string) =>
    edgeTypeMap.get(`${src}|${tgt}`)?.has(type) ?? false;

  // BFS
  const queue: [string, number][] = [[startId, 0]];
  visited.add(startId);

  while (queue.length > 0) {
    const [nodeId, d] = queue.shift()!;
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    subNodes.push(node);

    if (d >= depth) continue;

    // Forward edges
    const targets = graph.adjacency.get(nodeId) || new Set();
    let netTargetCount = 0;
    for (const targetId of targets) {
      if (visited.has(targetId)) continue;
      const targetNode = graph.nodes.get(targetId);
      if (!targetNode) continue;

      const isNetworkEdge = hasEdgeType(nodeId, targetId, 'network-allows');
      const isFamilyEdge = hasEdgeType(nodeId, targetId, 'family-member');
      const isShared =
        (targetNode.type === 'configmap' && SHARED_CONFIGMAPS.has(targetNode.name)) ||
        (targetNode.type === 'secret' && SHARED_SECRETS.has(targetNode.name));

      // Limit network targets to 5 per node
      if (isNetworkEdge) {
        if (netTargetCount >= 5) continue;
        netTargetCount++;
      }

      visited.add(targetId);
      if (isShared || isNetworkEdge || isFamilyEdge) {
        // Leaf node — include but don't BFS further
        subNodes.push(targetNode);
      } else {
        queue.push([targetId, d + 1]);
      }
    }

    // Selective reverse edges
    const sources = graph.reverseAdjacency.get(nodeId) || new Set();
    let networkCallerCount = 0;
    for (const sourceId of sources) {
      if (visited.has(sourceId)) continue;
      const sourceNode = graph.nodes.get(sourceId);
      if (!sourceNode) continue;

      // Allow ingress, service, servicemonitor to traverse normally
      if (['ingress', 'service', 'servicemonitor'].includes(sourceNode.type)) {
        visited.add(sourceId);
        queue.push([sourceId, d + 1]);
        continue;
      }

      // Network callers — add as leaf, max 5, only for the selected service
      if (nodeId === startId && sourceNode.type === 'deployment' && networkCallerCount < 5) {
        if (hasEdgeType(sourceId, nodeId, 'network-allows')) {
          visited.add(sourceId);
          subNodes.push(sourceNode);
          networkCallerCount++;
        }
      }
    }
  }

  // Collect all edges between visited nodes
  for (const edge of graph.edges) {
    if (visited.has(edge.source) && visited.has(edge.target)) {
      subEdges.push(edge);
    }
  }

  return { nodes: subNodes, edges: subEdges };
}

export function getServiceFamily(name: string): GraphNode[] {
  const graph = getGraph();
  const result: GraphNode[] = [];

  for (const node of graph.nodes.values()) {
    if (node.type === 'deployment' && node.metadata.family === name) {
      result.push(node);
    }
  }

  return result;
}

let fuseInstance: Fuse<{ name: string; type: string; ownerTeam: string; id: string }> | null = null;

export function searchServices(query: string, limit = 20) {
  if (!fuseInstance) {
    const graph = getGraph();
    const items: { name: string; type: string; ownerTeam: string; id: string }[] = [];

    for (const node of graph.nodes.values()) {
      if (['deployment', 'helm-chart'].includes(node.type)) {
        items.push({
          name: node.name,
          type: node.type,
          ownerTeam: node.metadata.ownerTeam || '',
          id: node.id,
        });
      }
    }

    fuseInstance = new Fuse(items, {
      keys: ['name', 'ownerTeam'],
      threshold: 0.3,
      includeScore: true,
    });
  }

  return fuseInstance.search(query, { limit }).map(r => r.item);
}

export function getAllDeployments() {
  const graph = getGraph();
  const results: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === 'deployment') {
      results.push(node);
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
