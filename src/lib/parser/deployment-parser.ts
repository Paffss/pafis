import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';
import { GraphNode } from '../graph/types';

interface K8sDeployment {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    replicas?: number;
    template?: {
      metadata?: {
        labels?: Record<string, string>;
      };
      spec?: {
        containers?: Array<{
          name?: string;
          image?: string;
          resources?: {
            requests?: { cpu?: string; memory?: string };
            limits?: { cpu?: string; memory?: string };
          };
          env?: Array<{
            name?: string;
            value?: string;
            valueFrom?: {
              configMapKeyRef?: { name: string; key: string };
              secretKeyRef?: { name: string; key: string };
            };
          }>;
          ports?: Array<{ name?: string; containerPort?: number }>;
          livenessProbe?: unknown;
          readinessProbe?: unknown;
        }>;
        volumes?: Array<{
          name?: string;
          secret?: { secretName?: string };
          configMap?: { name?: string };
        }>;
      };
    };
  };
}

// ── Environment detection ─────────────────────────────────────────────────────
type Environment = 'production' | 'staging' | 'qa' | 'dev' | 'unknown';

export function detectEnvironment(
  namespace: string | undefined,
  labels: Record<string, string>,
  envVars: Array<{ name?: string; value?: string }>,
): Environment {
  // 1. Explicit label: environment or env
  const labelVal = (labels['environment'] || labels['env'] || '').toLowerCase();
  if (labelVal.includes('prod'))    return 'production';
  if (labelVal.includes('stag'))    return 'staging';
  if (labelVal.includes('qa'))      return 'qa';
  if (labelVal.includes('dev'))     return 'dev';

  // 2. Env var: ENVIRONMENT or APP_ENV
  for (const e of envVars) {
    if (e.name === 'ENVIRONMENT' || e.name === 'APP_ENV') {
      const v = (e.value || '').toLowerCase();
      if (v.includes('prod'))  return 'production';
      if (v.includes('stag'))  return 'staging';
      if (v.includes('qa'))    return 'qa';
      if (v.includes('dev'))   return 'dev';
    }
  }

  // 3. Namespace name heuristic
  const ns = (namespace || '').toLowerCase();
  if (ns.includes('prod'))  return 'production';
  if (ns.includes('stag'))  return 'staging';
  if (ns.includes('qa'))    return 'qa';
  if (ns.includes('dev'))   return 'dev';

  return 'unknown';
}

export interface ServiceDep {
  name: string;
  host: string;
  port: number;
}

export interface DeploymentData {
  node: GraphNode;
  configMapRefs: Map<string, string[]>; // configmap name -> keys
  secretRefs: string[];
  dbSecrets: string[]; // secrets matching *-db-secret
  serviceDeps: ServiceDep[]; // from CONNECTION_CHECKER_SERVICES
}

export function parseDeployments(): DeploymentData[] {
  const dir = DATA_PATHS.deployments;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
  const results: DeploymentData[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const doc = yaml.load(content) as K8sDeployment;
      if (!doc?.metadata?.name) continue;

      const name = doc.metadata.name;
      const labels = doc.spec?.template?.metadata?.labels || {};
      const container = doc.spec?.template?.spec?.containers?.[0];
      const volumes = doc.spec?.template?.spec?.volumes || [];

      // Extract configmap references and CONNECTION_CHECKER_SERVICES from env vars
      const configMapRefs = new Map<string, string[]>();
      const serviceDeps: ServiceDep[] = [];
      for (const env of container?.env || []) {
        const cmRef = env.valueFrom?.configMapKeyRef;
        if (cmRef) {
          const keys = configMapRefs.get(cmRef.name) || [];
          keys.push(cmRef.key);
          configMapRefs.set(cmRef.name, keys);
        }
        // Parse CONNECTION_CHECKER_SERVICES: "name:host:port,name:host:port,..."
        if (env.name === 'CONNECTION_CHECKER_SERVICES' && env.value) {
          for (const entry of env.value.split(',')) {
            const parts = entry.trim().split(':');
            if (parts.length >= 3) {
              serviceDeps.push({
                name: parts[0],
                host: parts[1],
                port: parseInt(parts[2]) || 0,
              });
            }
          }
        }
      }

      // Extract secret references from volumes
      const secretRefs: string[] = [];
      const dbSecrets: string[] = [];
      for (const vol of volumes) {
        if (vol.secret?.secretName) {
          const secretName = vol.secret.secretName;
          secretRefs.push(secretName);
          if (secretName.endsWith('-db-secret')) {
            dbSecrets.push(secretName);
          }
        }
        // Also check configMap volumes
        if (vol.configMap?.name) {
          const keys = configMapRefs.get(vol.configMap.name) || [];
          configMapRefs.set(vol.configMap.name, keys);
        }
      }

      const node: GraphNode = {
        id: `deploy:${name}`,
        type: 'deployment',
        name,
        metadata: {
          namespace: doc.metadata.namespace,
          ownerTeam: doc.metadata.labels?.owner_team || labels.owner_team,
          replicas: doc.spec?.replicas,
          framework: labels.framework,
          tech: labels.tech,
          image: container?.image,
          cpuRequest: container?.resources?.requests?.cpu,
          memoryRequest: container?.resources?.requests?.memory,
          cpuLimit: container?.resources?.limits?.cpu,
          memoryLimit: container?.resources?.limits?.memory,
          ports: container?.ports?.map(p => ({
            name: p.name || 'unnamed',
            port: p.containerPort || 0,
          })),
          hasLivenessProbe: !!container?.livenessProbe,
          hasReadinessProbe: !!container?.readinessProbe,
          configMapKeys: Object.fromEntries(configMapRefs),
          environment: detectEnvironment(
            doc.metadata.namespace,
            labels,
            container?.env || [],
          ),
        },
        rawYaml: content,
      };

      results.push({ node, configMapRefs, secretRefs, dbSecrets, serviceDeps });
    } catch (e) {
      console.warn(`Failed to parse ${file}:`, e);
    }
  }

  return results;
}