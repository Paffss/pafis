variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude AI analysis"
  type        = string
  sensitive   = true
}

variable "demo_username" {
  description = "Demo login username"
  type        = string
  default     = "user"
}

variable "demo_password" {
  description = "Demo login password"
  type        = string
  sensitive   = true
  default     = "pass123!"
}

variable "session_secret" {
  description = "Secret used to sign session cookies"
  type        = string
  sensitive   = true
}

variable "grafana_cloud_url" {
  description = "Grafana Cloud Prometheus URL with embedded basic auth credentials"
  type        = string
  sensitive   = true
}
