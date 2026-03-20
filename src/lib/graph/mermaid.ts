import { Subgraph, GraphNode, SHARED_CONFIGMAPS, SHARED_SECRETS } from './types';

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/[<>]/g, '');
}

const MIN_LABEL_WIDTH = 12;

function padLabel(text: string): string {
  if (text.length >= MIN_LABEL_WIDTH) return text;
  const padding = MIN_LABEL_WIDTH - text.length;
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return '\u2002'.repeat(left) + text + '\u2002'.repeat(right);
}

function nodeLabel(node: GraphNode): string {
  return padLabel(node.name);
}

export function generateMermaid(subgraph: Subgraph, centerNodeName?: string): string {
  if (subgraph.nodes.length === 0) return 'graph TD\n  empty["No data found"]';

  const lines: string[] = ['graph TD'];

  // Group nodes by type
  const groups: Record<string, GraphNode[]> = {};
  for (const node of subgraph.nodes) {
    const group = node.type;
    if (!groups[group]) groups[group] = [];
    groups[group].push(node);
  }

  const groupConfig: Record<string, { label: string; order: number }> = {
    ingress: { label: 'Ingress', order: 1 },
    service: { label: 'Services', order: 2 },
    deployment: { label: 'Deployments', order: 3 },
    configmap: { label: 'ConfigMaps', order: 4 },
    secret: { label: 'Secrets', order: 5 },
    database: { label: 'Databases', order: 6 },
    'helm-chart': { label: 'Helm Charts', order: 7 },
    servicemonitor: { label: 'Monitoring', order: 8 },
  };

  // Sort groups by order
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    return (groupConfig[a[0]]?.order || 99) - (groupConfig[b[0]]?.order || 99);
  });

  // Add nodes in subgraphs
  for (const [type, nodes] of sortedGroups) {
    const config = groupConfig[type] || { label: type };
    lines.push(`  subgraph ${config.label}`);
    for (const node of nodes) {
      const sid = sanitizeId(node.id);
      const label = escapeLabel(nodeLabel(node));
      // Use different shapes for different types
      switch (node.type) {
        case 'database':
          lines.push(`    ${sid}[("${label}")]`);
          break;
        case 'ingress':
          lines.push(`    ${sid}>"${label}"]`);
          break;
        case 'configmap':
          lines.push(`    ${sid}["${label}"]`);
          break;
        case 'secret':
          lines.push(`    ${sid}{{"${label}"}}`);
          break;
        default:
          lines.push(`    ${sid}["${label}"]`);
      }
    }
    lines.push('  end');
  }

  // Add edges
  for (const edge of subgraph.edges) {
    const src = sanitizeId(edge.source);
    const tgt = sanitizeId(edge.target);
    switch (edge.type) {
      case 'family-member':
        lines.push(`  ${src} -.- ${tgt}`);
        break;
      case 'uses-configmap':
        lines.push(`  ${src} -.-> ${tgt}`);
        break;
      case 'uses-secret':
        lines.push(`  ${src} -.-> ${tgt}`);
        break;
      case 'uses-database':
        lines.push(`  ${src} ==> ${tgt}`);
        break;
      case 'network-allows':
        lines.push(`  ${src} --> ${tgt}`);
        break;
      default:
        lines.push(`  ${src} --> ${tgt}`);
    }
  }

  // Add styles
  lines.push('');
  lines.push('  classDef deploy fill:#3b82f6,stroke:#1d4ed8,color:#fff');
  lines.push('  classDef svc fill:#8b5cf6,stroke:#6d28d9,color:#fff');
  lines.push('  classDef ing fill:#f97316,stroke:#c2410c,color:#fff');
  lines.push('  classDef cm fill:#22c55e,stroke:#15803d,color:#fff');
  lines.push('  classDef sec fill:#ef4444,stroke:#b91c1c,color:#fff');
  lines.push('  classDef db fill:#a855f7,stroke:#7e22ce,color:#fff');
  lines.push('  classDef helm fill:#06b6d4,stroke:#0e7490,color:#fff');
  lines.push('  classDef monitor fill:#64748b,stroke:#475569,color:#fff');

  // Apply styles to nodes
  for (const node of subgraph.nodes) {
    const sid = sanitizeId(node.id);
    switch (node.type) {
      case 'deployment': lines.push(`  class ${sid} deploy`); break;
      case 'service': lines.push(`  class ${sid} svc`); break;
      case 'ingress': lines.push(`  class ${sid} ing`); break;
      case 'configmap': lines.push(`  class ${sid} cm`); break;
      case 'secret': lines.push(`  class ${sid} sec`); break;
      case 'database': lines.push(`  class ${sid} db`); break;
      case 'helm-chart': lines.push(`  class ${sid} helm`); break;
      case 'servicemonitor': lines.push(`  class ${sid} monitor`); break;
    }
  }

  return lines.join('\n');
}
