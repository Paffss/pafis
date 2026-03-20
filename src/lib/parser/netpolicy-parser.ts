import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';

interface NetPolicyConfig {
  name: string;
  allowedClients?: string[];
}

export interface NetPolicyData {
  service: string;
  allowedClients: string[];
}

export function parseNetworkPolicies(): NetPolicyData[] {
  const dir = path.join(DATA_PATHS.deployments, '..', '..', 'network-policies');
  if (!fs.existsSync(dir)) return [];

  const results: NetPolicyData[] = [];

  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const docs = yaml.loadAll(content) as NetPolicyConfig[];
      for (const doc of docs) {
        if (!doc?.name) continue;
        results.push({
          service: doc.name,
          allowedClients: doc.allowedClients || [],
        });
      }
    }
  } catch {
    // Network policies are optional
  }

  return results;
}
