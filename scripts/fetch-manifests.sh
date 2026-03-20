#!/usr/bin/env bash
# =============================================================================
# PAFIS — Manifest Fetcher
# Dumps Kubernetes manifests from any cluster (minikube, EKS, GKE, etc.)
# into the local directory structure that PAFIS expects.
#
# Usage:
#   ./scripts/fetch-manifests.sh              # uses current kubectl context
#   ./scripts/fetch-manifests.sh --context minikube
#   ./scripts/fetch-manifests.sh --namespace my-ns
#   ./scripts/fetch-manifests.sh --output ./my-data
# =============================================================================

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
OUTPUT_DIR="./data"
CONTEXT=""
NAMESPACE="--all-namespaces"
NS_FLAG="--all-namespaces"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --context)   CONTEXT="--context $2"; shift 2 ;;
    --namespace) NS_FLAG="-n $2"; NAMESPACE="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

KUBECTL="kubectl $CONTEXT"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "  ✔ $*"; }
warn() { echo "  ⚠ $*"; }
sep()  { echo ""; echo "── $* ──────────────────────────────────────────"; }

# ── Preflight ─────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  PAFIS  Manifest Fetcher                  ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

if ! command -v kubectl &>/dev/null; then
  echo "ERROR: kubectl not found. Install it first: https://kubernetes.io/docs/tasks/tools/"
  exit 1
fi

CURRENT_CONTEXT=$($KUBECTL config current-context 2>/dev/null || echo "unknown")
echo "  Cluster context : $CURRENT_CONTEXT"
echo "  Namespace       : ${NAMESPACE}"
echo "  Output dir      : $OUTPUT_DIR"
echo ""

# Confirm
read -p "  Proceed? [y/N] " -n 1 -r
echo ""
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── Directory setup ───────────────────────────────────────────────────────────
sep "Creating directories"
DIRS=(
  "$OUTPUT_DIR/kubernetes/deploy"
  "$OUTPUT_DIR/kubernetes/svc"
  "$OUTPUT_DIR/kubernetes/ing"
  "$OUTPUT_DIR/kubernetes/job"
  "$OUTPUT_DIR/kubernetes/servicemonitors"
  "$OUTPUT_DIR/kubernetes/configmaps"
  "$OUTPUT_DIR/helm-charts"
)
for d in "${DIRS[@]}"; do mkdir -p "$d"; done
log "Directories ready"

# ── Fetch resources ───────────────────────────────────────────────────────────

fetch_resources() {
  local KIND=$1
  local DIR=$2
  local EXTRA_FLAGS="${3:-}"

  sep "Fetching $KIND"
  local ITEMS
  # shellcheck disable=SC2086
  ITEMS=$($KUBECTL get "$KIND" $NS_FLAG $EXTRA_FLAGS \
    -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{"\n"}{end}' 2>/dev/null) || true

  if [[ -z "$ITEMS" ]]; then
    warn "No $KIND found (or not installed)"
    return
  fi

  local COUNT=0
  while IFS= read -r item; do
    [[ -z "$item" ]] && continue
    NS="${item%%/*}"
    NAME="${item##*/}"
    # shellcheck disable=SC2086
    $KUBECTL get "$KIND" "$NAME" -n "$NS" $CONTEXT -o yaml 2>/dev/null \
      > "$DIR/${NS}__${NAME}.yaml" && COUNT=$((COUNT+1))
  done <<< "$ITEMS"

  log "Saved $COUNT $KIND manifests → $DIR"
}

fetch_resources "deployments"     "$OUTPUT_DIR/kubernetes/deploy"
fetch_resources "services"        "$OUTPUT_DIR/kubernetes/svc"
fetch_resources "ingresses"       "$OUTPUT_DIR/kubernetes/ing"
fetch_resources "jobs"            "$OUTPUT_DIR/kubernetes/job"
fetch_resources "configmaps"      "$OUTPUT_DIR/kubernetes/configmaps"

# ServiceMonitors (optional — requires Prometheus Operator CRDs)
sep "Fetching ServiceMonitors"
if $KUBECTL get crd servicemonitors.monitoring.coreos.com &>/dev/null 2>&1; then
  fetch_resources "servicemonitors" "$OUTPUT_DIR/kubernetes/servicemonitors"
else
  warn "ServiceMonitor CRD not found — skipping (install Prometheus Operator to enable)"
fi

# ── Helm charts ───────────────────────────────────────────────────────────────
sep "Fetching Helm releases"
if command -v helm &>/dev/null; then
  # shellcheck disable=SC2086
  RELEASES=$( helm list $NS_FLAG $CONTEXT --output json 2>/dev/null | \
    python3 -c "import sys,json; [print(r['name']+'|'+r['namespace']) for r in json.load(sys.stdin)]" 2>/dev/null ) || true

  COUNT=0
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    REL_NAME="${rel%%|*}"
    REL_NS="${rel##*|}"
    CHART_DIR="$OUTPUT_DIR/helm-charts/$REL_NAME"
    mkdir -p "$CHART_DIR"

    # Write Chart.yaml with release metadata
    # shellcheck disable=SC2086
    helm get metadata "$REL_NAME" -n "$REL_NS" $CONTEXT -o json 2>/dev/null | \
      python3 -c "
import sys, json, yaml
d = json.load(sys.stdin)
chart = {
  'apiVersion': 'v2',
  'name': d.get('name', ''),
  'version': d.get('chart', '0.0.0').split('-')[-1],
  'appVersion': d.get('app_version', ''),
  'description': f'Helm release {d.get(\"name\",\"\")} in namespace {d.get(\"namespace\",\"\")}',
}
print(yaml.dump(chart))
" > "$CHART_DIR/Chart.yaml" 2>/dev/null && COUNT=$((COUNT+1)) || true

  done <<< "$RELEASES"
  log "Saved $COUNT Helm chart stubs → $OUTPUT_DIR/helm-charts"
else
  warn "helm not found — skipping Helm charts (install: https://helm.sh/docs/intro/install/)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  Done! Summary:                           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Deployments  : $(find "$OUTPUT_DIR/kubernetes/deploy" -name "*.yaml" | wc -l | tr -d ' ')"
echo "  Services     : $(find "$OUTPUT_DIR/kubernetes/svc"    -name "*.yaml" | wc -l | tr -d ' ')"
echo "  Ingresses    : $(find "$OUTPUT_DIR/kubernetes/ing"    -name "*.yaml" | wc -l | tr -d ' ')"
echo "  ConfigMaps   : $(find "$OUTPUT_DIR/kubernetes/configmaps" -name "*.yaml" | wc -l | tr -d ' ')"
echo "  Helm charts  : $(find "$OUTPUT_DIR/helm-charts" -name "Chart.yaml" | wc -l | tr -d ' ')"
echo ""
echo "  Next steps:"
echo "    1. Set PAFIS_BASE=$(realpath "$OUTPUT_DIR") in your .env.local"
echo "    2. Run: npm run dev"
echo "    3. Open: http://localhost:3000"
echo ""
