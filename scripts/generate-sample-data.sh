#!/usr/bin/env bash
# =============================================================================
# PAFIS — Sample Data Generator
# Creates a realistic set of fake K8s manifests so you can run PAFIS locally
# without connecting to any cluster at all. Great for demos and development.
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

# ── Helper ─────────────────────────────────────────────────────────────────
write_deploy() {
  local NAME=$1 TEAM=$2 REPLICAS=$3 CPU_REQ=$4 CPU_LIM=$5 MEM_REQ=$6 MEM_LIM=$7 IMAGE=$8 DEPS="${9:-}"
  local CONN_CHECKER=""
  if [[ -n "$DEPS" ]]; then
    CONN_CHECKER="        - name: CONNECTION_CHECKER_SERVICES
          value: \"$DEPS\""
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
          limits:
            cpu: $CPU_LIM
            memory: $MEM_LIM
        ports:
        - name: http
          containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
        env:
        - name: APP_ENV
          value: production
        - name: LOG_LEVEL
          value: info
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: $NAME-config
              key: db_host
$CONN_CHECKER
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
  local NAME=$1
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
  - port: 80
    targetPort: 8080
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
  feature_flags: "v2_ui=true,dark_mode=true"
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
dependencies: []
YAML
}

# ── Generate services ────────────────────────────────────────────────────────

# api-gateway — frontend-facing, high replicas, routes to many services
write_deploy "api-gateway"    "platform"  3  "200m" "500m"  "256Mi"  "512Mi"  "myrepo/api-gateway:v2.1.0" \
  "auth-service:auth-service:8080,user-service:user-service:8080,product-service:product-service:8080"
write_deploy "api-gateway-consumer" "platform" 2 "100m" "300m" "128Mi" "256Mi" "myrepo/api-gateway:v2.1.0" ""

# auth
write_deploy "auth-service"   "platform"  2  "100m" "250m"  "128Mi"  "256Mi"  "myrepo/auth-service:v1.5.2" \
  "redis:redis:6379"

# user
write_deploy "user-service"   "backend"   2  "150m" "400m"  "256Mi"  "512Mi"  "myrepo/user-service:v3.0.1" \
  "notification-service:notification-service:8080"
write_deploy "user-service-worker" "backend" 1 "50m" "200m" "64Mi" "128Mi" "myrepo/user-service:v3.0.1" ""

# product
write_deploy "product-service" "backend"  3  "200m" "600m"  "512Mi"  "1Gi"    "myrepo/product-service:v1.2.0" \
  "inventory-service:inventory-service:8080,pricing-service:pricing-service:8080"

# inventory
write_deploy "inventory-service" "backend" 2 "100m" "300m" "256Mi" "512Mi" "myrepo/inventory-service:v0.9.4" ""

# pricing — no limits set (risk!)
write_deploy "pricing-service" "data"     1  "100m" ""      "128Mi"  ""       "myrepo/pricing-service:v0.3.1" \
  "kafka:kafka:9092"

# notification — single replica (SPOF risk!)
write_deploy "notification-service" "platform" 1 "50m" "150m" "64Mi" "128Mi" "myrepo/notification-service:v2.0.0" \
  "kafka:kafka:9092,rabbitmq:rabbitmq:5672"

# report
write_deploy "report-service" "data"      2  "500m" "2000m" "1Gi"    "2Gi"    "myrepo/report-service:v1.1.0" \
  "user-service:user-service:8080,product-service:product-service:8080"

# frontend (no probes — risk!)
cat > "$OUT/kubernetes/deploy/frontend.yaml" << YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: default
  labels:
    owner_team: frontend
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        owner_team: frontend
    spec:
      containers:
      - name: frontend
        image: myrepo/frontend:v4.0.0
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 300m
            memory: 256Mi
        ports:
        - name: http
          containerPort: 3000
        env:
        - name: API_URL
          value: http://api-gateway
YAML

# Services
for svc in api-gateway auth-service user-service product-service inventory-service pricing-service notification-service report-service frontend; do
  write_svc "$svc"
done

# ConfigMaps
for cm in api-gateway auth-service user-service product-service inventory-service pricing-service notification-service report-service; do
  write_cm "$cm"
done

# Ingress
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
  - host: app.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
YAML

# ServiceMonitors
for svc in api-gateway auth-service user-service product-service report-service; do
  cat > "$OUT/kubernetes/servicemonitors/$svc.yaml" << YAML
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: $svc
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: $svc
  endpoints:
  - port: http
    path: /metrics
YAML
done

# Helm charts
write_helm "api-gateway"         "2.1.0" "API Gateway — entry point for all client traffic"
write_helm "auth-service"        "1.5.2" "Authentication and authorization service"
write_helm "user-service"        "3.0.1" "User profile and account management"
write_helm "product-service"     "1.2.0" "Product catalog and metadata"
write_helm "notification-service" "2.0.0" "Email and push notification delivery"
write_helm "report-service"      "1.1.0" "Async report generation and export"
write_helm "redis"               "18.0.0" "In-memory cache and session store"
write_helm "kafka"               "26.0.0" "Distributed event streaming"
write_helm "rabbitmq"            "12.0.0" "Message broker for async tasks"

echo ""
echo "  ✔ Sample data generated in $OUT"
echo "  ✔ $(find "$OUT/kubernetes/deploy" -name "*.yaml" | wc -l | tr -d ' ') deployments"
echo "  ✔ $(find "$OUT/kubernetes/svc" -name "*.yaml" | wc -l | tr -d ' ') services"
echo "  ✔ $(find "$OUT/helm-charts" -name "Chart.yaml" | wc -l | tr -d ' ') helm charts"
echo ""
echo "  Next: set PAFIS_BASE=$(realpath "$OUT") in .env.local, then npm run dev"
