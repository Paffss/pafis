import fs from 'fs';
import path from 'path';
import { DATA_PATHS } from '../config';

export interface NetPolicyData {
  source: string;
  destination: string;
  port: number;
}

export function parseNetworkPolicies(): NetPolicyData[] {
  const dir = path.join(path.dirname(DATA_PATHS.deployments), '..', 'network-policies');
  if (!fs.existsSync(dir)) return [];

  const results: NetPolicyData[] = [];

  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const srcMatch = content.match(/^source:\s*(.+)$/m);
      const dstMatch = content.match(/^destination:\s*(.+)$/m);
      const portMatch = content.match(/^port:\s*(\d+)$/m);
      if (srcMatch && dstMatch) {
        results.push({
          source: srcMatch[1].trim(),
          destination: dstMatch[1].trim(),
          port: portMatch ? parseInt(portMatch[1]) : 80,
        });
      }
    }
  } catch {
    // Network policies are optional
  }

  return results;
}
