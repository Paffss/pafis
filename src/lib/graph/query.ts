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

export interface SearchItem {
  name: string;
  type: string;
  ownerTeam: string;
  environment: string;
  id: string;
  noLimits: boolean;
  latestTag: boolean;
  noLivenessProbe: boolean;
  singleReplica: boolean;
}

let fuseInstance: Fuse<SearchItem> | null = null;
let allItems: SearchItem[] = [];

function buildIndex() {
  if (fuseInstance) return;
  const graph = getGraph();
  allItems = [];

  for (const node of graph.nodes.values()) {
    if (['deployment', 'helm-chart'].includes(node.type)) {
      allItems.push({
        name:            node.name,
        type:            node.type,
        ownerTeam:       node.metadata.ownerTeam || '',
        environment:     node.metadata.environment || 'unknown',
        id:              node.id,
        noLimits:        !node.metadata.cpuLimit && !node.metadata.memoryLimit,
        latestTag:       node.metadata.image?.endsWith(':latest') ?? false,
        noLivenessProbe: !node.metadata.hasLivenessProbe,
        singleReplica:   (node.metadata.replicas ?? 1) === 1,
      });
    }
  }

  fuseInstance = new Fuse(allItems, {
    keys: ['name', 'ownerTeam', 'environment'],
    threshold: 0.3,
    includeScore: true,
  });
}

// Parse filter tokens from query string
// Supports: team:payments env:production risk:latest risk:nolimits risk:noprobe
function parseQuery(query: string): { text: string; filters: Record<string, string> } {
  const filters: Record<string, string> = {};
  const tokens = query.split(/\s+/);
  const textTokens: string[] = [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx).toLowerCase();
      const val = token.slice(colonIdx + 1).toLowerCase();
      if (['team', 'env', 'environment', 'risk'].includes(key)) {
        filters[key] = val;
        continue;
      }
    }
    textTokens.push(token);
  }

  return { text: textTokens.join(' ').trim(), filters };
}

export function searchServices(query: string, limit = 20): SearchItem[] {
  buildIndex();
  const { text, filters } = parseQuery(query);

  let results: SearchItem[] = text
    ? fuseInstance!.search(text, { limit: limit * 2 }).map(r => r.item)
    : [...allItems];

  // Apply token filters
  if (filters.team)        results = results.filter(r => r.ownerTeam.toLowerCase().includes(filters.team));
  if (filters.env)         results = results.filter(r => r.environment.toLowerCase().includes(filters.env));
  if (filters.environment) results = results.filter(r => r.environment.toLowerCase().includes(filters.environment));
  if (filters.risk) {
    const risk = filters.risk;
    if (risk === 'latest' || risk === 'latesttag') results = results.filter(r => r.latestTag);
    else if (risk === 'nolimits' || risk === 'limits') results = results.filter(r => r.noLimits);
    else if (risk === 'noprobe' || risk === 'probe' || risk === 'noliveness') results = results.filter(r => r.noLivenessProbe);
    else if (risk === 'single' || risk === 'singlereplica') results = results.filter(r => r.singleReplica);
  }

  return results.slice(0, limit);
}

// Get all available teams and environments for autocomplete
export function getFilterOptions(): { teams: string[]; environments: string[] } {
  buildIndex();
  const teams = [...new Set(allItems.map(i => i.ownerTeam).filter(Boolean))].sort();
  const envs  = [...new Set(allItems.map(i => i.environment).filter(e => e !== 'unknown'))].sort();
  return { teams, environments: envs };
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