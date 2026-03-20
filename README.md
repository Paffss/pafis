# 🔭 PAFIS

> **P**redictive **A**nalysis **F**or **I**nfrastructure **S**ervices

AI-powered Kubernetes infrastructure intelligence. Point it at any cluster (or a folder of YAML files) and PAFIS will map your service dependencies, identify risks, and estimate costs — all from a browser.

## What it does

Search for a service and PAFIS will:

1. **Draw a dependency diagram** (Mermaid) — configmaps, secrets, databases, kafka, rabbitmq, redis, ingresses, network policies, service family members. Interactive: drag to pan, Ctrl+scroll to zoom, hover for details, toggle layers on/off
2. **AI analysis** (Claude / Ollama) — explains what the service does, identifies risks & misconfigurations, suggests improvements. Streams progressively in 4 stages (Purpose → Risks → Improvements → Dependencies)
3. **Cost estimation** — queries Prometheus for actual CPU/memory usage vs declared requests, calculates monthly cost and potential savings
4. **Dashboard** — global infrastructure stats, team distribution, risk overview

## Quick start (with sample data — no cluster needed)

```bash
git clone https://github.com/your-username/pafis.git
cd pafis
npm install
cp .env.local.example .env.local

# Generate realistic fake manifests to explore the UI
npm run sample-data

# Edit .env.local and set:
#   PAFIS_BASE=./data
#   ANTHROPIC_API_KEY=sk-ant-...

npm run dev
# Open http://localhost:3000
```

## Quick start (from a real cluster)

```bash
# From minikube
npm run fetch:minikube

# From any cluster (uses current kubectl context)
npm run fetch:cluster

# From a specific context / namespace
bash scripts/fetch-manifests.sh --context my-context --namespace production

# Then point PAFIS at the data
echo "PAFIS_BASE=./data" >> .env.local
npm run dev
```

## Prerequisites

- **Node.js 20+** (install via [nvm](https://github.com/nvm-sh/nvm))
- **kubectl** — for cluster fetching (optional)
- **helm** — for Helm release fetching (optional)
- **Anthropic API key** or **Ollama** — for AI analysis

## Configuration

```env
# Path to your manifest data (populated by fetch scripts or sample-data)
PAFIS_BASE=./data

# Prometheus URL (optional — cost panel disabled without it)
PROMETHEUS_URL=http://localhost:9090

# AI Provider: "anthropic" (default) or "ollama"
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (alternative to Anthropic)
# AI_PROVIDER=ollama
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=llama3
```

## Data directory structure

```
data/
├── kubernetes/
│   ├── deploy/          # Deployment YAML files
│   ├── svc/             # Service YAML files
│   ├── ing/             # Ingress YAML files
│   ├── job/             # Job YAML files
│   ├── servicemonitors/ # Prometheus ServiceMonitor YAML files
│   └── configmaps/      # ConfigMap YAML files
└── helm-charts/         # Helm charts (Chart.yaml files)
```

The `fetch-manifests.sh` script populates this automatically. For custom setups, override individual paths with env vars (see `src/lib/config.ts`).

## Docker

```bash
docker build -t pafis:latest .

# Mount your manifest data
docker run --rm \
  -p 3000:3000 \
  -v /path/to/your/data:/data \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  pafis:latest
```

## Architecture

```
Browser (Next.js React)
├── Dashboard — global stats, team distribution, risk overview
├── Search — fuzzy autocomplete over all deployments + helm charts
├── Dependency diagram — Mermaid with pan/zoom, layer toggles, hover tooltips
├── AI analysis — 4-stage streaming (Purpose → Risks → Improvements → Dependencies)
└── Cost panel — Prometheus metrics vs manifest resource requests

Next.js API Routes
├── GET  /api/services        → service index (fuzzy search)
├── GET  /api/graph/:name     → dependency subgraph → Mermaid syntax
├── GET  /api/manifest/:name  → raw YAML + metadata + family
├── POST /api/analyze/:name   → AI streaming analysis
├── GET  /api/metrics/:name   → Prometheus cost data
└── GET  /api/stats           → global infrastructure stats

Data Pipeline (parsed at startup → in-memory graph)
├── Deployment parser → nodes + configmap/secret/database edges
├── Service parser → selector-based links to deployments
├── Ingress parser → host/path routing to services
├── Helm parser → Chart.yaml dependency graph
├── Network policy parser → service-to-service ACL edges
├── CONNECTION_CHECKER_SERVICES → kafka/rabbitmq/redis/inter-service deps
└── ServiceMonitor parser → monitoring links
```

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **TailwindCSS** — cyber-themed dark UI
- **Mermaid** — interactive dependency diagrams
- **@anthropic-ai/sdk** — Claude AI analysis
- **js-yaml** — YAML parsing
- **Fuse.js** — fuzzy search
- **Prometheus HTTP API** — resource metrics & cost estimation
