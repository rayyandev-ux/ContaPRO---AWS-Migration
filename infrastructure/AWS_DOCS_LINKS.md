# Links de Documentación AWS y Terraform

---

## Terraform AWS Provider

### Documentación General

| Recurso | Link |
|---------|------|
| **Terraform AWS Provider** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs |
| **Terraform AWS Provider GitHub** | https://github.com/hashicorp/terraform-provider-aws |
| **Terraform AWS Provider Release Notes** | https://github.com/hashicorp/terraform-provider-aws/releases |

---

## Módulo `network`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_vpc** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpc |
| **aws_subnet** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/subnet |
| **aws_internet_gateway** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/internet_gateway |
| **aws_eip** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/eip |
| **aws_nat_gateway** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/nat_gateway |
| **aws_route_table** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/route_table |
| **aws_route_table_association** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/route_table_association |

---

## Módulo `security`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_security_group** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/security_group |
| **aws_vpc_security_group_ingress_rule** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpc_security_group_ingress_rule |
| **aws_vpc_security_group_egress_rule** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpc_security_group_egress_rule |

---

## Módulo `backend`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_ecr_repository** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecr_repository |
| **aws_ecs_cluster** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_cluster |
| **aws_ecs_task_definition** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_task_definition |
| **aws_ecs_service** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service |
| **aws_iam_role** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role |
| **aws_iam_role_policy** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy |
| **aws_iam_role_policy_attachment** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy_attachment |
| **aws_lb** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb |
| **aws_lb_target_group** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb_target_group |
| **aws_lb_listener** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb_listener |
| **aws_cloudwatch_log_group** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_group |

---

## Módulo `frontend`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_s3_bucket** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket |
| **aws_s3_bucket_ownership_controls** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_ownership_controls |
| **aws_s3_bucket_public_access_block** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_public_access_block |
| **aws_s3_bucket_policy** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_policy |
| **aws_cloudfront_origin_access_control** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_origin_access_control |
| **aws_cloudfront_distribution** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution |
| **aws_cloudfront_custom_error_response** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_custom_error_response |

---

## Módulo `storage`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_s3_bucket** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket |
| **aws_s3_bucket_public_access_block** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_public_access_block |
| **aws_s3_bucket_cors_configuration** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_cors_configuration |

---

## Módulo `database`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_rds_cluster** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/rds_cluster |
| **aws_rds_cluster_instance** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/rds_cluster_instance |
| **aws_db_subnet_group** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/db_subnet_group |
| **aws_secretsmanager_secret** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/secretsmanager_secret |
| **aws_secretsmanager_secret_version** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/secretsmanager_secret_version |
| **random_password** | https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password |

---

## Módulo `cache`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_elasticache_cluster** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/elasticache_cluster |
| **aws_elasticache_subnet_group** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/elasticache_subnet_group |

---

## Módulo `auth`

| Recurso AWS | Documentación Terraform |
|-------------|----------------------|
| **aws_cognito_user_pool** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cognito_user_pool |
| **aws_cognito_user_pool_client** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cognito_user_pool_client |

---

## Data Sources Útiles

| Data Source | Link |
|-------------|------|
| **aws_region** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/region |
| **aws_caller_identity** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity |
| **aws_ami** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ami |
| **aws_availability_zones** | https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/availability_zones |

---

## Módulos Pre-hechos de Terraform AWS

| Módulo | Link |
|--------|------|
| **terraform-aws-modules/vpc/aws** | https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest |
| **terraform-aws-modules/ecs/aws** | https://registry.terraform.io/modules/terraform-aws-modules/ecs/aws/latest |
| **terraform-aws-modules/rds-aurora/aws** | https://registry.terraform.io/modules/terraform-aws-modules/rds-aurora/aws/latest |
| **terraform-aws-modules/security-group/aws** | https://registry.terraform.io/modules/terraform-aws-modules/security-group/aws/latest |
| **terraform-aws-modules/alb/aws** | https://registry.terraform.io/modules/terraform-aws-modules/alb/aws/latest |

---

## Documentación Oficial AWS

### Redes y VPC
- **Amazon VPC**: https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html
- **Subredes**: https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html
- **Internet Gateway**: https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html
- **NAT Gateway**: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html

### Contenedores
- **Amazon ECS**: https://docs.aws.amazon.com/ecs/
- **AWS Fargate**: https://docs.aws.amazon.com/AmazonECS/latest/userguide/what-is-fargate.html
- **Amazon ECR**: https://docs.aws.amazon.com/ecr/

### Balanceador de Carga
- **Application Load Balancer**: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html

### Almacenamiento
- **Amazon S3**: https://docs.aws.amazon.com/s3/
- **S3 Pre-signed URLs**: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-urls.html

### CDN
- **Amazon CloudFront**: https://docs.aws.amazon.com/cloudfront/

### Bases de Datos
- **Amazon Aurora**: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora.ArgumentReference.html
- **Aurora Serverless v2**: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html

### Caché
- **Amazon ElastiCache**: https://docs.aws.amazon.com/elasticache/
- **ElastiCache for Redis**: https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html

### Autenticación
- **Amazon Cognito**: https://docs.aws.amazon.com/cognito/
- **Cognito User Pools**: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html

### Correo
- **Amazon SES**: https://docs.aws.amazon.com/ses/

### Secretos
- **AWS Secrets Manager**: https://docs.aws.amazon.com/secretsmanager/

### IAM
- **IAM**: https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html
- **IAM Roles**: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html

### Observabilidad
- **Amazon CloudWatch**: https://docs.aws.amazon.com/cloudwatch/
- **CloudWatch Logs**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html

---

## Terraform General

| Recurso | Link |
|---------|------|
| **Terraform Docs** | https://developer.hashicorp.com/terraform/docs |
| **Terraform Language Documentation** | https://developer.hashicorp.com/terraform/language |
| **Terraform Functions** | https://developer.hashicorp.com/terraform/language/functions |
| **Terraform Data Sources** | https://developer.hashicorp.com/terraform/language/data-sources |
| **Terraform Resources** | https://developer.hashicorp.com/terraform/language/resources |
| **Terraform State** | https://developer.hashicorp.com/terraform/language/state |
| **Terraform Providers** | https://developer.hashicorp.com/terraform/language/providers |
| **Terraform Modules** | https://developer.hashicorp.com/terraform/language/modules |
| **Terraform CLI** | https://developer.hashicorp.com/terraform/cli |
| **Terraform init** | https://developer.hashicorp.com/terraform/cli/commands/init |
| **Terraform plan** | https://developer.hashicorp.com/terraform/cli/commands/plan |
| **Terraform apply** | https://developer.hashicorp.com/terraform/cli/commands/apply |
| **Terraform destroy** | https://developer.hashicorp.com/terraform/cli/commands/destroy |
| **Terraform validate** | https://developer.hashicorp.com/terraform/cli/commands/validate |
| **Terraform fmt** | https://developer.hashicorp.com/terraform/cli/commands/fmt |
| **Terraform show** | https://developer.hashicorp.com/terraform/cli/commands/show |
