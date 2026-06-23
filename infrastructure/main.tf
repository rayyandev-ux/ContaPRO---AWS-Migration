# =============================================================================
# ContaPRO - Infraestructura AWS (raíz)
# Orquesta todos los módulos y conecta sus outputs/inputs entre sí.
#
# Arquitectura (según diagrama Excalidraw):
#   Internet → CloudFront + WAF (frontend) → S3
#   Internet → API Gateway → VPC Link → ALB interno → ECS Fargate (backend)
#   ECS → Aurora PostgreSQL | ElastiCache Redis | S3 (uploads)
#   Cognito (auth) | Route 53 + ACM (DNS/SSL) | CloudWatch + SNS (monitoring)
#
# Región: us-east-2 (Ohio) | VPC: 172.16.0.0/16 | Multi-AZ: 2a + 2b
# =============================================================================

# --- DNS: Route 53 + ACM + SES ---
# Crear PRIMERO para tener los nameservers y certificados que usan otros módulos
module "dns" {
  source = "./modules/dns"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name         = var.project_name
  environment          = var.environment
  domain_name          = var.domain_name
  enable_custom_domain = var.enable_custom_domain
}

# --- Red: VPC 172.16.0.0/16, subnets públicas/privadas, IGW, NAT, S3 Endpoint ---
module "network" {
  source = "./modules/network"

  project_name       = var.project_name
  environment        = var.environment
  region             = var.region
  availability_zones = ["${var.region}a", "${var.region}b"]
}

# --- Security Groups: VPC Link → ALB → ECS → Aurora/Redis ---
module "security" {
  source = "./modules/security"

  project_name   = var.project_name
  environment    = var.environment
  vpc_id         = module.network.vpc_id
  vpc_cidr       = module.network.vpc_cidr
  container_port = 8080
}

# --- Auth: Cognito User Pool + App Client ---
module "auth" {
  source = "./modules/auth"

  project_name = var.project_name
  environment  = var.environment
}

# --- Storage: bucket S3 privado para archivos subidos por usuarios ---
module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
}

# --- Base de datos: Aurora PostgreSQL Serverless v2 + Secrets Manager ---
module "database" {
  source = "./modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.network.private_subnet_ids
  aurora_sg_id       = module.security.aurora_sg_id
}

# --- Caché: ElastiCache Redis (BullMQ / colas del backend) ---
module "cache" {
  source = "./modules/cache"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.network.private_subnet_ids
  redis_sg_id        = module.security.redis_sg_id
}

# --- Backend: ECR + ECS Fargate + ALB INTERNO + Auto Scaling ---
module "backend" {
  source = "./modules/backend"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  alb_sg_id          = module.security.alb_sg_id
  ecs_sg_id          = module.security.ecs_sg_id
  container_port     = 8080

  uploads_bucket_name       = module.storage.uploads_bucket_id
  uploads_bucket_arn        = module.storage.uploads_bucket_arn
  db_credentials_secret_arn = module.database.db_credentials_secret_arn
  redis_url                 = module.cache.redis_url
  cognito_user_pool_id      = module.auth.user_pool_id
  cognito_client_id         = module.auth.user_pool_client_id
  frontend_url              = "https://${module.frontend.cloudfront_domain_name}"
}

# --- WAF: protección contra rate limiting y ataques (scope CLOUDFRONT → us-east-1) ---
module "waf" {
  source = "./modules/waf"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name = var.project_name
  environment  = var.environment
}

# --- Frontend: S3 + CloudFront + WAF ---
module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment

  waf_web_acl_arn = module.waf.web_acl_arn

  enable_custom_domain = var.enable_custom_domain
  domain_name          = var.domain_name
  acm_certificate_arn  = module.dns.cloudfront_certificate_arn
  hosted_zone_id       = module.dns.hosted_zone_id
}

# --- API Gateway: punto de entrada público del backend ---
# Internet → API Gateway → VPC Link → ALB interno → ECS
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.network.private_subnet_ids
  vpc_link_sg_id     = module.security.vpc_link_sg_id
  alb_listener_arn   = module.backend.alb_listener_arn

  enable_custom_domain = var.enable_custom_domain
  domain_name          = var.domain_name
  certificate_arn      = module.dns.regional_certificate_arn
  hosted_zone_id       = module.dns.hosted_zone_id
}

# --- Monitoring: CloudWatch Alarms + SNS ---
module "monitoring" {
  source = "./modules/monitoring"

  project_name     = var.project_name
  environment      = var.environment
  ecs_cluster_name = module.backend.ecs_cluster_name
  ecs_service_name = module.backend.ecs_service_name
  alb_arn_suffix   = module.backend.alb_arn_suffix
}
