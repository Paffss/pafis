terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Data sources ──────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "domain" {
  name         = "alphathedogstore.com"
  private_zone = false
}

# ── ECR Repository ────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "pafis" {
  name                 = "pafis"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = "pafis"
  }
}

resource "aws_ecr_lifecycle_policy" "pafis" {
  repository = aws_ecr_repository.pafis.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}

# ── IAM Role for App Runner ───────────────────────────────────────────────────

resource "aws_iam_role" "apprunner_access" {
  name = "pafis-apprunner-ecr-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ── App Runner Service ────────────────────────────────────────────────────────

resource "aws_apprunner_service" "pafis" {
  service_name = "pafis"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.pafis.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NODE_ENV                     = "production"
          PAFIS_BASE                   = "/app/data"
          AI_PROVIDER                  = "anthropic"
          NEXT_PUBLIC_DATA_MODE        = "sample"
          NODE_TLS_REJECT_UNAUTHORIZED = "0"
        }
        runtime_environment_secrets = {
          ANTHROPIC_API_KEY = aws_secretsmanager_secret_version.anthropic_key.arn
          DEMO_USERNAME     = aws_secretsmanager_secret_version.demo_username.arn
          DEMO_PASSWORD     = aws_secretsmanager_secret_version.demo_password.arn
          SESSION_SECRET    = aws_secretsmanager_secret_version.session_secret.arn
          PROMETHEUS_URL    = aws_secretsmanager_secret_version.grafana_cloud_url.arn
        }
      }
    }
    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = "0.25 vCPU"
    memory            = "0.5 GB"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 3
  }

  tags = {
    Project = "pafis"
  }

  depends_on = [aws_iam_role_policy_attachment.apprunner_ecr]
}

# ── Secrets Manager ───────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "anthropic_key" {
  name                    = "pafis/anthropic-api-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "anthropic_key" {
  secret_id     = aws_secretsmanager_secret.anthropic_key.id
  secret_string = var.anthropic_api_key
}

resource "aws_secretsmanager_secret" "demo_username" {
  name                    = "pafis/demo-username"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "demo_username" {
  secret_id     = aws_secretsmanager_secret.demo_username.id
  secret_string = var.demo_username
}

resource "aws_secretsmanager_secret" "demo_password" {
  name                    = "pafis/demo-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "demo_password" {
  secret_id     = aws_secretsmanager_secret.demo_password.id
  secret_string = var.demo_password
}

resource "aws_secretsmanager_secret" "session_secret" {
  name                    = "pafis/session-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "session_secret" {
  secret_id     = aws_secretsmanager_secret.session_secret.id
  secret_string = var.session_secret
}

resource "aws_secretsmanager_secret" "grafana_cloud_url" {
  name                    = "pafis/grafana-cloud-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "grafana_cloud_url" {
  secret_id     = aws_secretsmanager_secret.grafana_cloud_url.id
  secret_string = var.grafana_cloud_url
}

# ── IAM Role for App Runner instance ─────────────────────────────────────────

resource "aws_iam_role" "apprunner_instance" {
  name = "pafis-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_secrets" {
  name = "pafis-read-secrets"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.anthropic_key.arn,
        aws_secretsmanager_secret.demo_username.arn,
        aws_secretsmanager_secret.demo_password.arn,
        aws_secretsmanager_secret.session_secret.arn,
        aws_secretsmanager_secret.grafana_cloud_url.arn,
      ]
    }]
  })
}

# ── Custom Domain + Route 53 ──────────────────────────────────────────────────

resource "aws_apprunner_custom_domain_association" "pafis" {
  domain_name          = "pafis.alphathedogstore.com"
  service_arn          = aws_apprunner_service.pafis.arn
  enable_www_subdomain = false
}

resource "aws_route53_record" "pafis" {
  zone_id = data.aws_route53_zone.domain.zone_id
  name    = "pafis.alphathedogstore.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_apprunner_service.pafis.service_url]
}

resource "aws_route53_record" "pafis_validation" {
  for_each = {
    for r in tolist(aws_apprunner_custom_domain_association.pafis.certificate_validation_records) :
    r.name => r
    if r.name != ""
  }
  zone_id = data.aws_route53_zone.domain.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]

  depends_on = [aws_apprunner_custom_domain_association.pafis]
}
