# =============================================================================
# Outputs raíz
#
# Después de `terraform apply`:
#   1. Copiar los nameservers a GoDaddy (Custom Nameservers)
#   2. Usar ecr_repository_url, ecs_cluster_name, ecs_service_name en GitHub Actions
#   3. Usar api_endpoint como NEXT_PUBLIC_API_BASE en el build del frontend
#   4. Cargar los secretos de la app con: aws secretsmanager put-secret-value
#   5. Suscribir email al SNS topic para recibir alertas
#
# Ver todos con: terraform output
# =============================================================================

# --- DNS ---
output "nameservers" {
  description = "Nameservers de Route 53. Configurar en GoDaddy: DNS > Nameservers > Custom"
  value       = module.dns.nameservers
}

# --- API Gateway (punto de entrada público del backend) ---
output "api_endpoint" {
  description = "URL pública de la API. Usar como NEXT_PUBLIC_API_BASE en el frontend"
  value       = module.api_gateway.api_endpoint
}

# --- Backend ---
output "ecr_repository_url" {
  description = "URL del repositorio ECR (GitHub Actions sube la imagen Docker aquí)"
  value       = module.backend.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS (para el workflow de deploy)"
  value       = module.backend.ecs_cluster_name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS (para el workflow de deploy)"
  value       = module.backend.ecs_service_name
}

output "app_secrets_name" {
  description = "Nombre del secreto en Secrets Manager para las API keys del backend"
  value       = module.backend.app_secrets_name
}

# --- Frontend ---
output "cloudfront_domain_name" {
  description = "Dominio público del frontend (https://<valor>)"
  value       = module.frontend.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribución CloudFront (para invalidar caché en deploy)"
  value       = module.frontend.cloudfront_distribution_id
}

output "frontend_bucket_name" {
  description = "Bucket S3 del frontend (GitHub Actions sube los archivos aquí)"
  value       = module.frontend.s3_bucket_name
}

# --- Auth (Cognito) ---
output "cognito_user_pool_id" {
  description = "User Pool ID (NEXT_PUBLIC_COGNITO_USER_POOL_ID)"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "App Client ID (NEXT_PUBLIC_COGNITO_CLIENT_ID)"
  value       = module.auth.user_pool_client_id
}

# --- Storage ---
output "uploads_bucket_name" {
  description = "Bucket S3 privado para archivos de usuarios"
  value       = module.storage.uploads_bucket_id
}

# --- Base de datos ---
output "aurora_endpoint" {
  description = "Endpoint de Aurora PostgreSQL (para migraciones Prisma)"
  value       = module.database.aurora_endpoint
}

output "db_credentials_secret_arn" {
  description = "ARN del secreto con credenciales de la BD y DATABASE_URL"
  value       = module.database.db_credentials_secret_arn
}

# --- Monitoring ---
output "sns_topic_arn" {
  description = "ARN del topic SNS. Suscribir email: aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint tu@email.com"
  value       = module.monitoring.sns_topic_arn
}
