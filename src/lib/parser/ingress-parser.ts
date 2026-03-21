import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';

interface K8sIngress {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    rules?: Array<{
      host?: string;
      http?: {
        paths?: Array<{
          path?: string;
          backend?: {
            service?: {
              name?: string;
              port?: { number?: number };
            };
          };
        }>;
      };
    }>;
  };
}

export interface IngressData {
  serviceName: string;
  environments: string[];
  hosts: string[];
  paths: string[];
}

export function parseIngresses(): Map<string, IngressData> {
  const dir = DATA_PATHS.ingress;
  const result = new Map<string, IngressData>();

  let envDirs: string[];
  try {
    envDirs = fs.readdirSync(dir).filter(d =>
      fs.statSync(path.join(dir, d)).isDirectory()
    );
  } catch {
    return result;
  }

  for (const env of envDirs) {
    const envDir = path.join(dir, env);
    let files: string[];
    try {
      files = fs.readdirSync(envDir).filter(f => f.endsWith('.yaml'));
    } catch {
      continue;
    }

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(envDir, file), 'utf-8');
        const doc = yaml.load(content) as K8sIngress;
        if (!doc?.spec?.rules) continue;

        for (const rule of doc.spec.rules) {
          for (const p of rule.http?.paths || []) {
            const svcName = p.backend?.service?.name;
            if (!svcName) continue;

            const existing = result.get(svcName) || {
              serviceName: svcName,
              environments: [],
              hosts: [],
              paths: [],
            };

            if (!existing.environments.includes(env)) {
              existing.environments.push(env);
            }
            if (rule.host && !existing.hosts.includes(rule.host)) {
              existing.hosts.push(rule.host);
            }
            if (p.path && !existing.paths.includes(p.path)) {
              existing.paths.push(p.path);
            }

            result.set(svcName, existing);
          }
        }
      } catch (e) {
        console.warn(`Failed to parse ingress ${env}/${file}:`, e);
      }
    }
  }

  return result;
}