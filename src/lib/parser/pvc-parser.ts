import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';
import { GraphNode } from '../graph/types';

interface K8sPVC {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    storageClassName?: string;
    resources?: {
      requests?: { storage?: string };
    };
    accessModes?: string[];
  };
}

// Storage cost per GB/month by storage class (AWS EBS)
const STORAGE_COST_PER_GB: Record<string, number> = {
  'gp3':      0.08,
  'gp2':      0.10,
  'io1':      0.125,
  'io2':      0.125,
  'standard': 0.10,
  'default':  0.10,
};

export function parseStorageBytes(storage: string): number {
  const match = storage.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  switch (unit) {
    case 'ki': return value * 1024;
    case 'mi': return value * 1024 ** 2;
    case 'gi': return value * 1024 ** 3;
    case 'ti': return value * 1024 ** 4;
    case 'k':  return value * 1000;
    case 'm':  return value * 1000 ** 2;
    case 'g':  return value * 1000 ** 3;
    case 't':  return value * 1000 ** 4;
    default:   return value;
  }
}

export function calculatePvcCost(storageBytes: number, storageClass: string): number {
  const gbSize = storageBytes / (1024 ** 3);
  const rate = STORAGE_COST_PER_GB[storageClass.toLowerCase()] ?? STORAGE_COST_PER_GB['default'];
  return gbSize * rate;
}

export interface PvcData {
  node: GraphNode;
  ownerDeploymentHint: string; // PVC name with common suffixes stripped
}

export function parsePVCs(): PvcData[] {
  const dir = DATA_PATHS.pvc;
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const results: PvcData[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const doc = yaml.load(content) as K8sPVC;
      if (!doc?.metadata?.name) continue;

      const name = doc.metadata.name;
      const storageClass = doc.spec?.storageClassName || 'gp3';
      const storageRaw = doc.spec?.resources?.requests?.storage || '0Gi';
      const storageBytes = parseStorageBytes(storageRaw);
      const costMonthly = calculatePvcCost(storageBytes, storageClass);

      // Strip common PVC suffixes to infer owner deployment
      const ownerDeploymentHint = name.replace(/-(?:data|storage|vol|pvc|volume|disk)$/, '');

      const node: GraphNode = {
        id: `pvc:${name}`,
        type: 'pvc',
        name,
        metadata: {
          namespace:       doc.metadata.namespace,
          pvcStorage:      storageRaw,
          pvcStorageClass: storageClass,
          pvcStorageBytes: storageBytes,
          pvcCostMonthly:  costMonthly,
        },
        rawYaml: content,
      };

      results.push({ node, ownerDeploymentHint });
    } catch (e) {
      console.warn(`Failed to parse PVC ${file}:`, e);
    }
  }

  return results;
}