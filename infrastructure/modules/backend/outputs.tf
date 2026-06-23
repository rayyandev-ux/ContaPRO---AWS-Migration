output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

# ARN del listener HTTP: lo usa el módulo api_gateway para la integración VPC Link
output "alb_listener_arn" {
  value = aws_lb_listener.http.arn
}

# Sufijo del ARN del ALB: lo usa el módulo monitoring para métricas CloudWatch
output "alb_arn_suffix" {
  value = aws_lb.main.arn_suffix
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "app_secrets_name" {
  value = aws_secretsmanager_secret.app_secrets.name
}
