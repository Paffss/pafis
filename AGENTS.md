# Agent Guidelines for PAFIS

**PAFIS** (Predictive Analysis For Infrastructure Services) is a Kubernetes infrastructure visualization and analysis tool. It parses K8s manifests (deployments, services, ingresses, Helm charts) into a graph-based data model, surfaces insights via a Next.js frontend, and leverages Claude AI for service analysis.

## Architecture Overview

### Core Data Flow
1. **Parsers** (`src/lib/parser/*.ts`): Read YAML files from `PAFIS_BASE` paths, extract structured metadata
2. **Graph Builder** (`src/lib/graph/builder.ts`): Combines parsed data into an in-memory `InfraGraph` with nodes (services, deployments, configmaps, secrets, Helm charts, databases) and typed edges (uses-configmap, routes-to, monitors, etc.)
3. **Query Layer** (`src/lib/graph/query.ts`): Provides subgraph extraction (BFS with intelligent depth limits), family grouping, and fuzzy search
4. **Frontend** (`src/components/`): React components for dashboard, service detail views, cost analysis, and diagrams
5. **API Routes** (`src/app/api/`): Service discovery, graph queries, AI-powered analysis via Anthropic SDK

### Critical Concepts

**Node IDs**: Prefixed by type (`deploy:svc-name`, `svc:svc-name`, `helm:chart-name`, `cm:configmap-name`, `db:db-name`, `secret:secret-name`, `ing:ingress-name`, `sm:servicemonitor-name`). Always use `findNodeByName()` which searches in priority order; never construct IDs manually.

**Graph Caching**: `getGraph()` in `builder.ts` caches the graph on first access. The entire graph is rebuilt from disk on each server restart — no hot-reload of infrastructure data.

**Subgraph Extraction**: `getServiceSubgraph(name, depth)` uses BFS with selective traversal:
- Forward edges: Follow all edges from a node up to `depth`
- Reverse edges: Only pull ingress → service, service → deployment, and servicemonitor → service (prevents pollution from shared configmaps)
- Shared nodes (`SHARED_CONFIGMAPS`, `SHARED_SECRETS`): Treated as leaves to avoid traversing hundreds of services

**Service Families**: Related services grouped by suffix (`-consumer`, `-web`, `-tasks`, etc. defined in `types.ts`). Used for bulk operations and cost aggregation.

## Key Patterns

### Adding a New Parser Type
1. Create `src/lib/parser/{type}-parser.ts` exporting `parse{Type}()` returning `{Type}Data[]`
2. Each result contains a `GraphNode` with `id: "{prefix}:{name}"` and `metadata` object
3. In `builder.ts`, call parser, add nodes to graph, establish edges
4. Update `query.ts` type handling if adding new node types
5. Export from `src/lib/parser/index.ts`

### Adding an API Endpoint
- Routes in `src/app/api/{resource}/[name]/route.ts` follow Next.js app-router conventions
- Most endpoints call `getGraph()` and query functions from `query.ts`
- Heavy computation (parsing, graph building) happens server-side; results cached/streamed to client

### Frontend Component Patterns
- Use `'use client'` directive for interactive components
- Fetch data in `useEffect` hooks, handle loading states
- Team colors defined in `SearchBar.tsx` dictionary; reuse with `TEAM_COLORS` lookup
- Tailwind CSS with dark theme (`bg-zinc-950`, `text-zinc-100`); no external UI library

## Data Sources & Environment

**Input paths** (from `lib/config.ts`):
```
$PAFIS_BASE/kubernetes/
  ├── deploy/           # Deployment YAML files
  ├── svc/              # Service YAML files
  ├── ing/              # Ingress YAML files
  ├── job/              # Job YAML files
  ├── servicemonitors/  # Prometheus ServiceMonitor YAML files
  └── configmaps/       # ConfigMap YAML files
$PAFIS_BASE/helm-charts/ # Helm Chart.yaml files
$PROMETHEUS_URL          # (http://localhost:9090) for metrics
$ANTHROPIC_API_KEY       # Claude API for service analysis
```

Default `PAFIS_BASE = ./data`; populate it with `npm run fetch:minikube` or `npm run sample-data`.

## Development Workflow

```bash
# Generate sample data (no cluster needed)
npm run sample-data

# OR fetch from minikube
npm run fetch:minikube

# Start dev server
npm run dev   # http://localhost:3000

# Build & production
npm run build && npm start

# Lint
npm run lint
```

## File Organization

| Path | Purpose |
|------|---------|
| `src/lib/config.ts` | Centralized paths & API keys |
| `src/lib/graph/types.ts` | Core data models (GraphNode, GraphEdge, NodeType, EdgeType) |
| `src/lib/graph/builder.ts` | Orchestrates parsers → graph; cached |
| `src/lib/graph/query.ts` | Graph queries (subgraph, search, family grouping) |
| `src/lib/parser/` | Individual YAML parsers; each independent |
| `src/components/` | React UI (dashboard, service details, diagrams, search) |
| `src/app/api/` | API endpoints |
| `src/app/page.tsx` | Main layout |
| `scripts/fetch-manifests.sh` | Dumps manifests from any K8s cluster |
| `scripts/generate-sample-data.sh` | Creates fake manifests for local dev |

## Conventions

1. **Node IDs always prefixed** by type; use `findNodeByName()` for reverse lookup
2. **Metadata is optional** but expected in typical parsers (ownerTeam, replicas, image, etc.)
3. **Shared nodes are leaves** in subgraph BFS to avoid over-traversal
4. **API responses are JSON** (array or single object); errors return plain text with HTTP status
5. **AI analysis cached in-memory**; safe for single-instance; replace `analysisCache` with Redis for multi-instance
