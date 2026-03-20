import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DATA_PATHS } from '../config';
import { GraphNode } from '../graph/types';

interface HelmChart {
  name?: string;
  version?: string;
  appVersion?: string;
  description?: string;
  dependencies?: Array<{
    name?: string;
    repository?: string;
    version?: string;
    condition?: string;
  }>;
  maintainers?: Array<{
    name?: string;
    email?: string;
  }>;
}

export interface HelmChartData {
  node: GraphNode;
  dependencyNames: string[];
}

export function parseHelmCharts(): HelmChartData[] {
  const dir = DATA_PATHS.helmCharts;
  const results: HelmChartData[] = [];

  let chartDirs: string[];
  try {
    chartDirs = fs.readdirSync(dir).filter(d =>
      fs.statSync(path.join(dir, d)).isDirectory()
    );
  } catch {
    return results;
  }

  for (const chartDir of chartDirs) {
    const chartYamlPath = path.join(dir, chartDir, 'Chart.yaml');
    if (!fs.existsSync(chartYamlPath)) continue;

    try {
      const content = fs.readFileSync(chartYamlPath, 'utf-8');
      const doc = yaml.load(content) as HelmChart;
      if (!doc?.name) continue;

      const dependencyNames = (doc.dependencies || [])
        .map(d => d.name)
        .filter((n): n is string => !!n);

      // Try to read values.yaml for additional context
      let valuesYaml = '';
      const valuesPath = path.join(dir, chartDir, 'values.yaml');
      if (fs.existsSync(valuesPath)) {
        valuesYaml = fs.readFileSync(valuesPath, 'utf-8');
      }

      const node: GraphNode = {
        id: `helm:${doc.name}`,
        type: 'helm-chart',
        name: doc.name,
        metadata: {
          version: doc.version,
          appVersion: doc.appVersion,
          maintainers: doc.maintainers?.map(m => m.name || 'unknown'),
          dependencies: dependencyNames,
        },
        rawYaml: content + (valuesYaml ? '\n---\n# values.yaml\n' + valuesYaml : ''),
      };

      results.push({ node, dependencyNames });
    } catch (e) {
      console.warn(`Failed to parse helm chart ${chartDir}:`, e);
    }
  }

  return results;
}
