import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';
import { GraphNode } from '../graph/types';

// AWS NLB base cost per LoadBalancer per month
const LB_COST_PER_MONTH = 18.0;

interface K8sService {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    selector?: Record<string, string>;
    ports?: Array<{
      port?: number;
      name?: string;
      targetPort?: string | number;
      protocol?: string;
    }>;
    type?: string;
  };
}

export interface ServiceData {
  node: GraphNode;
  selectorName: string;
  isLoadBalancer: boolean;
}

export function parseServices(): ServiceData[] {
  const dir = DATA_PATHS.services;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
  const results: ServiceData[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const doc = yaml.load(content) as K8sService;
      if (!doc?.metadata?.name) continue;

      const name = doc.metadata.name;
      const selectorName = doc.spec?.selector?.name || name;

      const node: GraphNode = {
        id: `svc:${name}`,
        type: 'service',
        name,
        metadata: {
          namespace: doc.metadata.namespace,
          ownerTeam: doc.metadata.labels?.owner_team,
          creator: doc.metadata.labels?.creator,
          serviceType: doc.spec?.type || 'ClusterIP',
          loadBalancerCostMonthly: doc.spec?.type === 'LoadBalancer' ? LB_COST_PER_MONTH : undefined,
          ports: doc.spec?.ports?.map(p => ({
            name: p.name || 'unnamed',
            port: p.port || 0,
          })),
        },
        rawYaml: content,
      };

      results.push({ node, selectorName, isLoadBalancer: doc.spec?.type === 'LoadBalancer' });
    } catch (e) {
      console.warn(`Failed to parse service ${file}:`, e);
    }
  }

  return results;
}