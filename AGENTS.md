# PAFIS — Agent & Developer Guide

PAFIS (Predictive Analysis For Infrastructure Services) is a Kubernetes infrastructure visualization and analysis tool. It parses K8s manifests into a graph-based data model, surfaces insights via a Next.js frontend, and leverages Claude AI for service analysis.

---

## Architecture Overview

### Core Data Flow

1. **Parsers** (`src/lib/parser/*.ts`): Read YAML files from `PAFIS_BASE` paths, extract structured metadata
2. **Graph Builder** (`src/lib/graph/builder.ts`): Combines parsed data into an in-memory `InfraGraph` with nodes (deployments, services, configmaps, secrets, helm charts, databases, ingresses, servicemonitors) and typed edges
3. **Query Layer** (`src/lib/graph/query.ts`): Subgraph extraction (BFS), family grouping, fuzzy search
4. **API Routes** (`src/app/api/`): Service discovery, graph queries, AI analysis, cost estimation, health check
5. **Frontend** (`src/components/`): React components for dashboard, service detail, diagrams, cost panel, auth

### Auth Flow

All routes are protected by `src/middleware.ts` which checks for a `pafis_session` cookie. Login is handled via `POST /api/auth` which validates `DEMO_USERNAME` / `DEMO_PASSWORD` env vars and sets an httpOnly session cookie signed with `SESSION_SECRET`. Access attempts are logged to stdout (visible in CloudWatch on AWS).

---

## Critical Concepts

**Node IDs:** Prefixed by type (`deploy:svc-name`, `svc:svc-name`, `helm:chart-name`, `cm:configmap-name`, `db:db-name`, `secret:secret-name`, `ing:ingress-name`, `sm:servicemonitor-name`). Always use `findNodeByName()` — never construct IDs manually.

**Graph Caching:** `getGraph()` in `builder.ts` caches the graph on first access. Rebuilt from disk on server restart. No hot-reload of infrastructure data — restart required after fetching new manifests.

**Risk Scoring:** `getRiskLevel()` in `mermaid.ts` scores each deployment node as `critical` (no limits, no probes, `:latest` tag) / `warning` (single replica, no requests) / `ok`. Drives node colors in the dependency diagram (red/yellow/green).

**Cost Estimation:** Calculated in `/api/metrics/[name]` and `/api/topcost` using approximate AWS EKS on-demand pricing:
- CPU: `$0.031 / core-hour × 730h/month × replicas`
- Memory: `$0.004 / GiB-hour × 730h/month × replicas`
- Requested cost uses manifest `resources.requests`; actual cost uses Prometheus P95 metrics when available

**Subgraph Extraction:** `getServiceSubgraph(name, depth)` uses BFS with selective traversal:
- Forward edges: Follow all edges up to `depth`
- Reverse edges: Only pull `ingress → service`, `service → deployment`, `servicemonitor → service`
- Shared nodes (`SHARED_CONFIGMAPS`, `SHARED_SECRETS`): Treated as leaves to avoid traversing hundreds of services

**AI Analysis:** 5-stage streaming analysis per service (Purpose → Risks → Improvements → Security → Dependencies). Provider is `anthropic` (Claude Sonnet) by default, with `ollama` as a local/offline fallback. Cached in-memory — replace `analysisCache` with Redis for multi-instance deployments.

---

## Key Patterns

### Adding a New Parser Type

1. Create `src/lib/parser/{type}-parser.ts` exporting `parse{Type}()` returning `{Type}Data[]`
2. Each result contains a `GraphNode` with `id: "{prefix}:{name}"` and metadata object
3. In `builder.ts`: call parser, add nodes, establish edges
4. Update `query.ts` type handling if adding new node types
5. Export from `src/lib/parser/index.ts`

### Adding an API Endpoint

- Routes in `src/app/api/{resource}/[name]/route.ts` follow Next.js App Router conventions
- Most endpoints call `getGraph()` and query functions from `query.ts`
- All routes are automatically protected by middleware — no per-route auth needed
- Heavy computation happens server-side; results cached/streamed to client

### Frontend Component Patterns

- Use `'use client'` directive for interactive components
- Fetch data in `useEffect` hooks, handle loading states explicitly
- Team colors defined in `Dashboard.tsx` as `TEAM_COLORS` array — reuse for consistency
- TailwindCSS dark theme (`bg-zinc-950`, `text-zinc-100`) — no external UI library
- Never use `<a href="...">` for internal navigation — use `<Link>` from `next/link`

---

## Data Sources & Environment

| Variable | Description | Default |
|---|---|---|
| `PAFIS_BASE` | Path to manifest data directory | `./data` |
| `ANTHROPIC_API_KEY` | Claude API key | — |
| `AI_PROVIDER` | `anthropic` or `ollama` | `anthropic` |
| `OLLAMA_URL` | Ollama base URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `llama3` |
| `PROMETHEUS_URL` | Prometheus for real usage metrics | `http://localhost:9090` |
| `NEXT_PUBLIC_DATA_MODE` | `sample`, `cluster`, or `auto` | `auto` |
| `DEMO_USERNAME` | Login username | `user` |
| `DEMO_PASSWORD` | Login password | — |
| `SESSION_SECRET` | Cookie signing secret | — |

Input paths (relative to `PAFIS_BASE`):

```
$PAFIS_BASE/kubernetes/
  ├── deploy/           # Deployment YAML files
  ├── svc/              # Service YAML files
  ├── ing/              # Ingress YAML files
  ├── configmaps/       # ConfigMap YAML files
  └── servicemonitors/  # Prometheus ServiceMonitor YAML files
$PAFIS_BASE/helm-charts/ # Helm Chart.yaml files
```

---

## Development Workflow

```bash
# Generate sample data (no cluster needed — 40+ realistic fintech/SaaS/DevOps services)
npm run sample-data

# OR fetch from minikube
npm run fetch:minikube

# OR fetch from any cluster (uses current kubectl context)
npm run fetch:cluster

# Start dev server
npm run dev   # http://localhost:3000

# Build
npm run build

# Lint + type check
npm run lint
npx tsc --noEmit
```

---

## File Organization

| Path | Purpose |
|---|---|
| `src/middleware.ts` | Auth gate — protects all routes via session cookie |
| `src/lib/config.ts` | Centralized env vars & paths |
| `src/lib/graph/types.ts` | Core data models (GraphNode, GraphEdge, NodeType, EdgeType) |
| `src/lib/graph/builder.ts` | Orchestrates parsers → graph; cached |
| `src/lib/graph/query.ts` | Graph queries (subgraph, search, family grouping) |
| `src/lib/graph/mermaid.ts` | Mermaid syntax generation with risk-based node coloring |
| `src/lib/parser/` | Individual YAML parsers; each independent |
| `src/components/` | React UI (dashboard, service details, diagrams, search, cost) |
| `src/app/api/` | API endpoints |
| `src/app/api/auth/` | Login/logout — sets session cookie |
| `src/app/api/health/` | Operational health check (graph, data, Prometheus, AI, memory) |
| `src/app/api/topcost/` | Top 10 most expensive services ranked by estimated monthly cost |
| `src/app/login/` | Login page |
| `src/app/health/` | Health status UI |
| `src/app/report/` | Printable PDF report |
| `src/app/page.tsx` | Main app layout |
| `scripts/fetch-manifests.sh` | Dumps manifests from any K8s cluster |
| `scripts/generate-sample-data.sh` | Creates realistic fake manifests for local dev |
| `scripts/deploy.sh` | Builds Docker image, pushes to ECR, triggers App Runner redeployment |
| `terraform/` | AWS infrastructure as code (ECR, App Runner, Route 53, Secrets Manager) |
| `.github/workflows/ci.yml` | CI/CD — lint → build → push to ECR → deploy to App Runner |

---

## Deployment

Infrastructure managed with Terraform on AWS:
- **ECR** — Docker image registry
- **App Runner** — runs the container, auto-scales, handles SSL
- **Secrets Manager** — stores API keys and auth credentials
- **Route 53** — custom domain 

```bash
# First time
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply

# Build and push image
bash scripts/deploy.sh

# Tear down
terraform destroy
```

CI/CD via GitHub Actions on every push to `main`: lint → build → push to ECR → trigger App Runner redeployment.

---
