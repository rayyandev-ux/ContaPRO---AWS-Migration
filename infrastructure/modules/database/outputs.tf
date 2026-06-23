output "aurora_endpoint" {
  description = "El endpoint del cluster de Aurora"
  value       = aws_rds_cluster.aurora.endpoint
}

output "db_credentials_secret_arn" {
  description = "ARN del secreto en AWS Secrets Manager que contiene las credenciales y el DATABASE_URL"
  value       = aws_secretsmanager_secret.db_credentials.arn
}
