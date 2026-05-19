# Documentación de Infraestructura AWS - ContaPRO

> Este archivo documenta la arquitectura completa de infraestructura en AWS creada con Terraform.

---

## 1. Arquitectura General

Tu infraestructura está organizada en **8 módulos independientes**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          VPC (10.0.0.0/16)                             │
│                                                                         │
│  ┌─────────────────┐          ┌─────────────────────────────────────┐ │
│  │ PUBLIC SUBNETS  │          │         PRIVATE SUBNETS               │ │
│  │ (10.0.1.0/24)  │          │  (10.0.3.0/24)  (10.0.4.0/24)      │ │
│  │ (10.0.2.0/24)  │          │                                     │ │
│  └────────┬────────┘          │  ┌─────────────┐  ┌──────────────┐  │ │
│           │                   │  │ ECS Fargate │  │   Aurora     │  │ │
│           │                   │  │  (Backend)  │  │ PostgreSQL   │  │ │
│           │                   │  └──────┬──────┘  └──────┬───────┘  │ │
│           │                   │         │                 │          │ │
│           ▼                   │  ┌─────▼─────────┐ ┌────▼─────┐    │ │
│  ┌─────────────────┐         │  │ ElastiCache  │  │ Secrets  │    │ │
│  │  NAT Gateway    │         │  │    Redis     │  │ Manager  │    │ │
│  └────────┬────────┘         │  └─────────────┘  └──────────┘    │ │
│           │                   └─────────────────────────────────────┘ │
└───────────┼───────────────────────────────────────────────────────────┘
            │
            ▼
   ┌─────────────────┐
   │INTERNET GATEWAY │
   └────────┬────────┘
            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                      WORLD WIDE WEB                              │
   │  CloudFront ──▶ S3 (Frontend)  │  ALB ──▶ ECS (Backend)        │
   │  Cognito (Auth)  │  SES (Email)  │  S3 (Uploads)               │
   └─────────────────────────────────────────────────────────────────┘
```

---

## 2. Módulos Terraform

| Módulo | Descripción | Recursos principales |
|--------|-------------|---------------------|
| `network` | VPC, Subnets, IGW, NAT | aws_vpc, aws_subnet, aws_nat_gateway |
| `security` | Security Groups | alb_sg, ecs_sg, aurora_sg, redis_sg |
| `backend` | ECS Fargate, ALB, ECR | aws_ecs_cluster, aws_lb, aws_ecr_repository |
| `frontend` | S3 + CloudFront | aws_s3_bucket, aws_cloudfront_distribution |
| `storage` | Bucket para uploads | aws_s3_bucket con CORS |
| `database` | Aurora Serverless v2 | aws_rds_cluster, aws_secretsmanager_secret |
| `cache` | ElastiCache Redis | aws_elasticache_cluster |
| `auth` | Cognito User Pool | aws_cognito_user_pool |

---

## 3. Flujo de Red (Security Groups)

```
Internet ──▶ ALB (80/443) ──▶ ECS (8080) ──▶ Aurora (5432)
                                    └──▶ Redis (6379)
```

| De | A | Puerto |
|----|---|--------|
| Internet | ALB | 80, 443 |
| ALB | ECS | 8080 |
| ECS | Aurora | 5432 |
| ECS | Redis | 6379 |

---

## 4. Variables de Entorno Inyectadas al Backend

```json
{
  "NODE_ENV": "production",
  "PORT": "8080",
  "USE_AWS_SES": "true",
  "S3_BUCKET_NAME": "<bucket-uploads>",
  "REDIS_URL": "redis://<endpoint>:6379",
  "DATABASE_URL": "<desde-Secrets-Manager>"
}
```

---

## 5. IAM Roles del Backend

| Rol | Permisos |
|-----|----------|
| `ecs_execution_role` | Leer imágenes ECR, escribir logs, leer Secrets Manager |
| `ecs_task_role` | Enviar emails (SES), acceder S3 uploads |

---

## 6. Comandos Terraform

```bash
terraform init
terraform validate
terraform plan -var-file="dev.tfvars"
terraform apply -var-file="dev.tfvars"
terraform destroy -var-file="dev.tfvars"
```
