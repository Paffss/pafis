import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';

interface K8sServiceMonitor {
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    selector?: {
      matchLabels?: Record<string, string>;
    };
    endpoints?: Array<{
      port?: string;
      interval?: string;
    }>;
  };
}

export interface ServiceMonitorData {
  name: string;
  targetServiceName: string;
}

export function parseServiceMonitors(): ServiceMonitorData[] {
  const dir = DATA_PATHS.serviceMonitors;
  const results: ServiceMonitorData[] = [];

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
  } catch {
    return results;
  }

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const doc = yaml.load(content) as K8sServiceMonitor;
      if (!doc?.metadata?.name) continue;

      const targetName =
        doc.spec?.selector?.matchLabels?.name ||
        doc.spec?.selector?.matchLabels?.['app.kubernetes.io/name'] ||
        doc.metadata.name;

      results.push({
        name: doc.metadata.name,
        targetServiceName: targetName,
      });
    } catch (e) {
      console.warn(`Failed to parse servicemonitor ${file}:`, e);
    }
  }

  return results;
}
