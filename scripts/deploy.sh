#!/usr/bin/env bash
# =============================================================================
# PAFIS — AWS Deploy Script
# Builds Docker image, pushes to ECR, triggers App Runner redeployment
# Run this after `terraform apply` has set up the infrastructure
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-eu-west-1}"
ECR_URL=$(terraform -chdir=terraform output -raw ecr_repository_url 2>/dev/null || echo "")

if [[ -z "$ECR_URL" ]]; then
  echo "ERROR: Could not get ECR URL from Terraform. Run 'terraform apply' first."
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  PAFIS  Deploy to AWS                     ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  ECR: $ECR_URL"
echo "  Region: $REGION"
echo ""

# Step 1: Regenerate sample data
echo "── Step 1: Generating sample data ────────────────"
npm run sample-data
echo ""

# Step 2: Docker login to ECR
echo "── Step 2: Authenticating with ECR ───────────────"
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$ECR_URL"
echo ""

# Step 3: Build image
echo "── Step 3: Building Docker image ─────────────────"
docker build -t pafis:latest .
echo ""

# Step 4: Tag and push
echo "── Step 4: Pushing to ECR ─────────────────────────"
docker tag pafis:latest "$ECR_URL:latest"
docker push "$ECR_URL:latest"
echo ""

# Step 5: Trigger App Runner redeployment
echo "── Step 5: Triggering App Runner redeployment ─────"
SERVICE_ARN=$(aws apprunner list-services --region "$REGION" \
  --query "ServiceSummaryList[?ServiceName=='pafis'].ServiceArn" \
  --output text)

if [[ -n "$SERVICE_ARN" ]]; then
  aws apprunner start-deployment \
    --service-arn "$SERVICE_ARN" \
    --region "$REGION" > /dev/null
  echo "  ✔ Redeployment triggered"
else
  echo "  ⚠ Could not find App Runner service — redeploy manually in AWS console"
fi

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  Done!                                    ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  App Runner URL : $(terraform -chdir=terraform output -raw app_runner_url 2>/dev/null || echo 'check AWS console')"
echo "  Public URL     : https://pafis.alphathedogstore.com"
echo ""
echo "  Note: App Runner takes ~2 minutes to deploy the new image."
echo "  DNS propagation for the custom domain may take up to 5 minutes."
echo ""