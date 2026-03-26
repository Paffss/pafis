#!/usr/bin/env bash
# =============================================================================
# PAFIS — Sample Data Generator
# Creates a realistic set of fake K8s manifests simulating a mid-size platform.
# Covers: SaaS core, Fintech, DevOps tooling
# =============================================================================
set -euo pipefail

OUT="${1:-./data}"

mkdir -p \
  "$OUT/kubernetes/deploy" \
  "$OUT/kubernetes/svc" \
  "$OUT/kubernetes/ing" \
  "$OUT/kubernetes/configmaps" \
  "$OUT/kubernetes/servicemonitors" \
  "$OUT/helm-charts"

echo "Generating sample manifests in $OUT ..."

# ── Helpers ──────────────────────────────────────────────────────────────────
write_deploy() {
  local NAME=$1 TEAM=$2 REPLICAS=$3 CPU_REQ=$4 CPU_LIM=$5 MEM_REQ=$6 MEM_LIM=$7 IMAGE=$8
  local HAS_LIVENESS=${9:-true} HAS_READINESS=${10:-true} DEPS="${11:-}" ENV="${12:-production}"
  local CONN=""
  if [[ -n "$DEPS" ]]; then
    CONN="        - name: CONNECTION_CHECKER_SERVICES
          value: \"$DEPS\""
  fi
  local LIVENESS="" READINESS=""
  if [[ "$HAS_LIVENESS" == "true" ]]; then
    LIVENESS="        livenessProbe:
          httpGet:
            path: /health
            port: 8080"
  fi
  if [[ "$HAS_READINESS" == "true" ]]; then
    READINESS="        readinessProbe:
          httpGet:
            path: /ready
            port: 8080"
  fi

  cat > "$OUT/kubernetes/deploy/$NAME.yaml" << YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $NAME
  namespace: default
  labels:
    owner_team: $TEAM
    app: $NAME
    environment: $ENV
spec:
  replicas: $REPLICAS
  selector:
    matchLabels:
      app: $NAME
  template:
    metadata:
      labels:
        app: $NAME
        owner_team: $TEAM
    spec:
      containers:
      - name: $NAME
        image: $IMAGE
        resources:
          requests:
            cpu: $CPU_REQ
            memory: $MEM_REQ
$(if [[ -n "$CPU_LIM" ]]; then echo "          limits:
            cpu: $CPU_LIM
            memory: $MEM_LIM"; fi)
        ports:
        - name: http
          containerPort: 8080
$LIVENESS
$READINESS
        env:
        - name: APP_ENV
          value: $ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: $NAME-config
              key: db_host
$CONN
        volumeMounts:
        - name: secret-vol
          mountPath: /etc/secrets
      volumes:
      - name: secret-vol
        secret:
          secretName: $NAME-db-secret
YAML
}

write_svc() {
  local NAME=$1 PORT=${2:-80}
  cat > "$OUT/kubernetes/svc/$NAME.yaml" << YAML
apiVersion: v1
kind: Service
metadata:
  name: $NAME
  namespace: default
spec:
  selector:
    app: $NAME
  ports:
  - port: $PORT
    targetPort: 8080
YAML
}

write_lb_svc() {
  local NAME=$1 PORT=${2:-80}
  cat > "$OUT/kubernetes/svc/$NAME.yaml" << YAML
apiVersion: v1
kind: Service
metadata:
  name: $NAME
  namespace: default
  labels:
    app: $NAME
spec:
  type: LoadBalancer
  selector:
    app: $NAME
  ports:
  - port: $PORT
    targetPort: 8080
    protocol: TCP
YAML
}

write_pvc() {
  local NAME=$1 STORAGE=$2 STORAGECLASS=${3:-gp3}
  mkdir -p "$OUT/kubernetes/pvc"
  cat > "$OUT/kubernetes/pvc/$NAME.yaml" << YAML
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: $NAME
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGECLASS
  resources:
    requests:
      storage: $STORAGE
YAML
}

write_cm() {
  local NAME=$1
  cat > "$OUT/kubernetes/configmaps/$NAME-config.yaml" << YAML
apiVersion: v1
kind: ConfigMap
metadata:
  name: $NAME-config
  namespace: default
data:
  db_host: "$NAME-db.default.svc.cluster.local"
  cache_ttl: "300"
  log_level: "info"
YAML
}

write_sm() {
  local NAME=$1
  cat > "$OUT/kubernetes/servicemonitors/$NAME.yaml" << YAML
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: $NAME
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: $NAME
  endpoints:
  - port: http
    path: /metrics
YAML
}

write_helm() {
  local NAME=$1 VERSION=$2 DESC=$3
  mkdir -p "$OUT/helm-charts/$NAME"
  cat > "$OUT/helm-charts/$NAME/Chart.yaml" << YAML
apiVersion: v2
name: $NAME
version: $VERSION
description: $DESC
YAML
}

# ══════════════════════════════════════════════════════════════════════════════
# SAAS CORE — platform team
# ══════════════════════════════════════════════════════════════════════════════

# api-gateway — 3 replicas, good config
write_deploy "api-gateway" "platform" 3 "200m" "500m" "256Mi" "512Mi" "myrepo/api-gateway:v2.3.1" "true" "true" \
  "auth-service:auth-service:8080,user-service:user-service:8080,billing-service:billing-service:8080,payment-service:payment-service:8080,fraud-service:fraud-service:8080" "production"
write_deploy "api-gateway-consumer" "platform" 2 "100m" "300m" "128Mi" "256Mi" "myrepo/api-gateway:v2.3.1" "true" "true" "" "production"

# auth
write_deploy "auth-service" "platform" 2 "150m" "400m" "256Mi" "512Mi" "myrepo/auth-service:v1.8.0" "true" "true" \
  "user-service:user-service:8080,token-service:token-service:8080" "production"
write_deploy "token-service" "platform" 2 "100m" "250m" "128Mi" "256Mi" "myrepo/token-service:v1.2.0" "true" "true" \
  "user-service:user-service:8080" "production"

# users
write_deploy "user-service" "backend" 3 "200m" "500m" "384Mi" "768Mi" "myrepo/user-service:v4.1.0" "true" "true" \
  "notification-service:notification-service:8080,audit-service:audit-service:8080" "staging"
write_deploy "user-service-worker" "backend" 2 "100m" "300m" "128Mi" "256Mi" "myrepo/user-service:v4.1.0" "true" "true" "" "staging"
write_deploy "profile-service" "backend" 2 "100m" "250m" "128Mi" "256Mi" "myrepo/profile-service:v2.0.0" "true" "true" \
  "user-service:user-service:8080,notification-service:notification-service:8080" "staging"

# notifications
write_deploy "notification-service" "platform" 1 "100m" "250m" "128Mi" "256Mi" "myrepo/notification-service:v3.0.0" "true" "true" \
  "kafka:kafka:9092,rabbitmq:rabbitmq:5672" "production"
write_deploy "email-service" "platform" 1 "50m" "" "64Mi" "" "myrepo/email-service:v1.5.0" "false" "false" \
  "kafka:kafka:9092" "staging"
write_deploy "sms-service" "platform" 1 "50m" "150m" "64Mi" "128Mi" "myrepo/sms-service:v1.1.0" "true" "false" "" "staging"

# billing
write_deploy "billing-service" "billing" 2 "200m" "500m" "384Mi" "768Mi" "myrepo/billing-service:v2.1.0" "true" "true" \
  "payment-service:payment-service:8080,invoice-service:invoice-service:8080,user-service:user-service:8080" "production"
write_deploy "invoice-service" "billing" 2 "150m" "400m" "256Mi" "512Mi" "myrepo/invoice-service:v1.3.0" "true" "true" \
  "notification-service:notification-service:8080,user-service:user-service:8080" "production"
write_deploy "subscription-service" "billing" 2 "150m" "" "256Mi" "" "myrepo/subscription-service:v1.0.0" "true" "true" \
  "billing-service:billing-service:8080,user-service:user-service:8080,notification-service:notification-service:8080" "production"

# analytics
write_deploy "analytics-service" "data" 2 "500m" "2000m" "1Gi" "2Gi" "myrepo/analytics-service:v1.4.0" "true" "true" \
  "kafka:kafka:9092" "qa"
write_deploy "report-service" "data" 1 "1000m" "" "2Gi" "" "myrepo/report-service:v2.0.0" "false" "false" \
  "analytics-service:analytics-service:8080,user-service:user-service:8080,ledger-service:ledger-service:8080" "qa"
write_deploy "metrics-aggregator" "data" 1 "200m" "500m" "512Mi" "1Gi" "myrepo/metrics-aggregator:v1.0.0" "true" "true" \
  "kafka:kafka:9092" "qa"

# frontend
write_deploy "frontend" "frontend" 3 "100m" "300m" "128Mi" "256Mi" "myrepo/frontend:v5.2.0" "true" "true" \
  "api-gateway:api-gateway:80" "staging"
write_deploy "admin-panel" "frontend" 1 "100m" "200m" "128Mi" "256Mi" "myrepo/admin-panel:v1.0.0" "true" "true" \
  "api-gateway:api-gateway:80" "staging"

# audit
write_deploy "audit-service" "platform" 2 "100m" "250m" "128Mi" "256Mi" "myrepo/audit-service:v1.2.0" "true" "true" \
  "fraud-service:fraud-service:8080" "production"

# ══════════════════════════════════════════════════════════════════════════════
# FINTECH — payments team
# ══════════════════════════════════════════════════════════════════════════════

write_deploy "payment-service" "payments" 3 "300m" "800m" "512Mi" "1Gi" "myrepo/payment-service:v3.2.0" "true" "true" \
  "fraud-service:fraud-service:8080,ledger-service:ledger-service:8080,auth-service:auth-service:8080" "production"
write_deploy "payment-worker" "payments" 2 "200m" "500m" "256Mi" "512Mi" "myrepo/payment-service:v3.2.0" "true" "true" "" "production"

write_deploy "fraud-service" "payments" 2 "500m" "1500m" "512Mi" "1Gi" "myrepo/fraud-service:v2.0.0" "true" "true" \
  "user-service:user-service:8080,auth-service:auth-service:8080" "production"
write_deploy "fraud-ml-service" "payments" 1 "2000m" "" "4Gi" "" "myrepo/fraud-ml:v1.0.0" "false" "false" \
  "kafka:kafka:9092" "production"

write_deploy "kyc-service" "compliance" 2 "200m" "500m" "384Mi" "768Mi" "myrepo/kyc-service:v1.5.0" "true" "true" \
  "user-service:user-service:8080,notification-service:notification-service:8080,auth-service:auth-service:8080" "qa"
write_deploy "kyc-worker" "compliance" 2 "150m" "400m" "256Mi" "512Mi" "myrepo/kyc-service:v1.5.0" "true" "true" "" "qa"

write_deploy "ledger-service" "payments" 2 "300m" "800m" "512Mi" "1Gi" "myrepo/ledger-service:v2.1.0" "true" "true" \
  "audit-service:audit-service:8080,notification-service:notification-service:8080" "production"
write_deploy "transaction-service" "payments" 3 "200m" "600m" "384Mi" "768Mi" "myrepo/transaction-service:v1.8.0" "true" "true" \
  "payment-service:payment-service:8080,ledger-service:ledger-service:8080,auth-service:auth-service:8080" "production"
write_deploy "reconciliation-service" "payments" 1 "500m" "" "1Gi" "" "myrepo/reconciliation-service:v1.0.0" "false" "false" \
  "ledger-service:ledger-service:8080,transaction-service:transaction-service:8080,audit-service:audit-service:8080" "production"

write_deploy "accounts-service" "payments" 2 "200m" "500m" "384Mi" "768Mi" "myrepo/accounts-service:v2.0.0" "true" "true" \
  "user-service:user-service:8080,ledger-service:ledger-service:8080,auth-service:auth-service:8080" "production"
write_deploy "wallet-service" "payments" 2 "150m" "400m" "256Mi" "512Mi" "myrepo/wallet-service:v1.2.0" "true" "true" \
  "accounts-service:accounts-service:8080,payment-service:payment-service:8080,notification-service:notification-service:8080" "production"

# ══════════════════════════════════════════════════════════════════════════════
# DEVOPS TOOLING — ops team (some intentionally misconfigured for demo)
# ══════════════════════════════════════════════════════════════════════════════

# no limits, no probes — will show up as critical in risk analysis
write_deploy "secret-manager" "ops" 1 "100m" "" "128Mi" "" "myrepo/secret-manager:latest" "false" "false" "" "dev"
write_deploy "registry-proxy" "ops" 1 "200m" "" "256Mi" "" "myrepo/registry-proxy:v1.0.0" "false" "false" "" "dev"
write_deploy "gitops-controller" "ops" 1 "200m" "500m" "256Mi" "512Mi" "myrepo/gitops-controller:v2.0.0" "true" "true" \
  "kafka:kafka:9092" "dev"
write_deploy "ci-runner" "ops" 2 "500m" "" "1Gi" "" "myrepo/ci-runner:latest" "false" "false" "" "dev"
write_deploy "artifact-store" "ops" 1 "200m" "500m" "512Mi" "1Gi" "myrepo/artifact-store:v1.0.0" "true" "true" "" "dev"

# deliberately missing owner_team label for demo
cat > "$OUT/kubernetes/deploy/legacy-importer.yaml" << YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: legacy-importer
  namespace: default
  labels:
    app: legacy-importer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: legacy-importer
  template:
    metadata:
      labels:
        app: legacy-importer
    spec:
      containers:
      - name: legacy-importer
        image: myrepo/legacy-importer:v0.1.0
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
YAML

# ── Services ──────────────────────────────────────────────────────────────────
for svc in api-gateway auth-service token-service user-service profile-service \
  notification-service email-service sms-service billing-service invoice-service \
  subscription-service analytics-service report-service frontend admin-panel \
  audit-service payment-service fraud-service fraud-ml-service kyc-service \
  ledger-service transaction-service reconciliation-service accounts-service \
  wallet-service secret-manager registry-proxy gitops-controller artifact-store; do
  write_svc "$svc"
done

# ── ConfigMaps ────────────────────────────────────────────────────────────────
for cm in api-gateway auth-service token-service user-service profile-service \
  notification-service billing-service invoice-service subscription-service \
  analytics-service payment-service fraud-service kyc-service ledger-service \
  transaction-service accounts-service wallet-service audit-service; do
  write_cm "$cm"
done

# ── ServiceMonitors ───────────────────────────────────────────────────────────
for sm in api-gateway auth-service user-service payment-service fraud-service \
  billing-service analytics-service transaction-service kyc-service ledger-service; do
  write_sm "$sm"
done

# ── Ingress ───────────────────────────────────────────────────────────────────
cat > "$OUT/kubernetes/ing/main.yaml" << YAML
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
  - host: admin.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-panel
            port:
              number: 80
YAML

# ── LoadBalancer services ─────────────────────────────────────────────────────
# These expose public-facing endpoints and incur AWS NLB cost (~$18/mo each)
write_lb_svc "api-gateway"       80   # production — public entry point
write_lb_svc "frontend"          80   # staging — customer-facing UI
write_lb_svc "admin-panel"       80   # staging — internal admin
write_lb_svc "payment-service"   8080 # production — payment gateway

# ── PersistentVolumeClaims ────────────────────────────────────────────────────
# Spread across storage classes to demo cost differences
mkdir -p "$OUT/kubernetes/pvc"

# production — payments & core
write_pvc "fraud-ml-service-data"      "50Gi"  "gp3"   # ML model storage
write_pvc "ledger-service-data"        "100Gi" "io1"   # high-IOPS financial ledger
write_pvc "transaction-service-data"   "200Gi" "gp3"   # transaction history
write_pvc "payment-service-data"       "20Gi"  "gp3"   # payment state

# staging — backend
write_pvc "user-service-data"          "30Gi"  "gp2"   # user profile storage
write_pvc "profile-service-data"       "20Gi"  "gp2"   # profile images/assets

# qa — data & compliance
write_pvc "analytics-service-data"     "500Gi" "gp3"   # analytics warehouse
write_pvc "report-service-data"        "100Gi" "gp2"   # report output storage
write_pvc "kyc-service-data"           "50Gi"  "io1"   # KYC documents (compliance)

# dev — ops tooling
write_pvc "artifact-store-data"        "200Gi" "gp3"   # CI artifact storage
write_pvc "gitops-controller-data"     "10Gi"  "gp2"   # gitops state

# ── Helm charts ───────────────────────────────────────────────────────────────
write_helm "api-gateway"          "2.3.1"  "API Gateway — entry point for all client traffic"
write_helm "auth-service"         "1.8.0"  "Authentication and token management"
write_helm "user-service"         "4.1.0"  "User profiles and account management"
write_helm "payment-service"      "3.2.0"  "Payment processing and orchestration"
write_helm "fraud-service"        "2.0.0"  "Real-time fraud detection"
write_helm "billing-service"      "2.1.0"  "Subscription billing and invoicing"
write_helm "kyc-service"          "1.5.0"  "KYC verification and compliance"
write_helm "notification-service" "3.0.0"  "Multi-channel notification delivery"
write_helm "analytics-service"    "1.4.0"  "Event analytics and reporting"
write_helm "ledger-service"       "2.1.0"  "Financial ledger and accounting"
write_helm "redis"                "18.0.0" "In-memory cache and session store"
write_helm "kafka"                "26.0.0" "Distributed event streaming"
write_helm "rabbitmq"             "12.0.0" "Message broker for async tasks"
write_helm "postgresql"           "13.0.0" "Primary relational database"

echo ""
echo "  ✔ Sample data generated in $OUT"
echo "  ✔ $(find "$OUT/kubernetes/deploy" -name "*.yaml" | wc -l | tr -d ' ') deployments"
echo "  ✔ $(find "$OUT/kubernetes/svc"    -name "*.yaml" | wc -l | tr -d ' ') services"
echo "  ✔ $(find "$OUT/helm-charts"       -name "Chart.yaml" | wc -l | tr -d ' ') helm charts"
echo "  ✔ $(find "$OUT/kubernetes/servicemonitors" -name "*.yaml" | wc -l | tr -d ' ') service monitors"
echo ""
echo "  Teams: platform, backend, billing, data, frontend, payments, compliance, ops"
echo "  Intentional issues: missing limits, :latest tags, no probes, missing owner_team"
echo ""
echo "  Next: set PAFIS_BASE=$(realpath "$OUT") in .env.local, then npm run dev"