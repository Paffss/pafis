output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.pafis.repository_url
}

output "app_runner_url" {
  description = "App Runner service URL"
  value       = "https://${aws_apprunner_service.pafis.service_url}"
}

output "pafis_url" {
  description = "Public URL for PAFIS"
  value       = "https://pafis.alphathedogstore.com"
}

output "push_commands" {
  description = "Commands to build and push Docker image"
  value       = <<-EOT
    # Build and push:
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.pafis.repository_url}
    docker build -t pafis .
    docker tag pafis:latest ${aws_ecr_repository.pafis.repository_url}:latest
    docker push ${aws_ecr_repository.pafis.repository_url}:latest
  EOT
}
