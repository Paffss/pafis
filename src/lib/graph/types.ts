export type NodeType =
  | 'deployment'
  | 'service'
  | 'ingress'
  | 'job'
  | 'configmap'
  | 'secret'
  | 'helm-chart'
  | 'database'
  | 'servicemonitor'
  | 'pvc';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  metadata: {
    namespace?: string;
    ownerTeam?: string;
    replicas?: number;
    framework?: string;
    tech?: string;
    image?: string;
    cpuRequest?: string;
    memoryRequest?: string;
    cpuLimit?: string;
    memoryLimit?: string;
    ports?: { name: string; port: number }[];
    hasLivenessProbe?: boolean;
    hasReadinessProbe?: boolean;
    hosts?: string[];
    paths?: string[];
    family?: string;
    creator?: string;
    version?: string;
    appVersion?: string;
    maintainers?: string[];
    dependencies?: string[];
    configMapKeys?: Record<string, string[]>; // configmap name -> keys used
    environment?: 'production' | 'staging' | 'qa' | 'dev' | 'unknown';
    serviceType?: string;           // ClusterIP | NodePort | LoadBalancer
    pvcStorage?: string;            // raw string e.g. "50Gi"
    pvcStorageClass?: string;       // gp2 | gp3 | io1 | standard | etc.
    pvcStorageBytes?: number;       // parsed bytes for cost calc
    pvcCostMonthly?: number;        // pre-calculated storage cost
    loadBalancerCostMonthly?: number; // pre-calculated LB cost
  };
  rawYaml?: string;
}

export type EdgeType =
  | 'uses-configmap'
  | 'uses-secret'
  | 'exposes'
  | 'routes-to'
  | 'monitors'
  | 'uses-database'
  | 'helm-depends'
  | 'family-member'
  | 'network-allows'
  | 'uses-pvc';

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface InfraGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, Set<string>>;
  reverseAdjacency: Map<string, Set<string>>;
}

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Shared nodes that connect to hundreds of services — collapse in diagrams
export const SHARED_CONFIGMAPS = new Set(['generic', 'features']);
export const SHARED_SECRETS = new Set(['services-auth', 'base-secret', 'keycloak-clients']);

// Known suffixes for service family grouping
export const FAMILY_SUFFIXES = [
  '-consumer',
  '-tasks',
  '-bo',
  '-cleanup',
  '-receiver',
  '-replicator',
  '-web',
  '-process',
  '-nodejs',
  '-processor-hi',
  '-processor-lo',
  '-mapper',
  '-scoreboard-mapper',
  '-match-mapper',
  '-streams-receiver',
  '-streams-web',
];