resource "aws_db_subnet_group" "aurora" {
  name       = "${var.project_name}-aurora-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-aurora-subnet-group-${var.environment}"
    Environment = var.environment
  }
}

# Generar una contraseña aleatoria para la base de datos
resource "random_password" "db_password" {
  length  = 16
  special = false
}

# Versión más reciente disponible de Aurora PostgreSQL en la región.
# Se consulta dinámicamente para evitar fijar una versión que AWS retire
# (por ejemplo, la 15.3 ya no se puede usar para clusters nuevos).
data "aws_rds_engine_version" "postgresql" {
  engine = "aurora-postgresql"
  latest = true
}

# Cluster de Aurora Serverless v2 (PostgreSQL)
# engine_mode "provisioned" + serverlessv2_scaling_configuration = Serverless v2
resource "aws_rds_cluster" "aurora" {
  #checkov:skip=CKV_AWS_139: Deletion protection disabled for dev environment easy teardown
  #checkov:skip=CKV_AWS_327: Using default AWS encryption, KMS CMK adds cost for dev
  #checkov:skip=CKV2_AWS_8: AWS Backup plan not needed for dev, using built-in Aurora backups
  #checkov:skip=CKV2_AWS_27: Query logging requires custom parameter group, will configure for prod
  cluster_identifier                  = "${var.project_name}-aurora-cluster-${var.environment}"
  engine                              = "aurora-postgresql"
  engine_mode                         = "provisioned"
  engine_version                      = data.aws_rds_engine_version.postgresql.version
  database_name                       = "contapro"
  master_username                     = "postgres"
  master_password                     = random_password.db_password.result
  db_subnet_group_name                = aws_db_subnet_group.aurora.name
  vpc_security_group_ids              = [var.aurora_sg_id]
  skip_final_snapshot                 = true
  storage_encrypted                   = true
  iam_database_authentication_enabled = true
  copy_tags_to_snapshot               = true
  enabled_cloudwatch_logs_exports     = ["postgresql"]

  serverlessv2_scaling_configuration {
    max_capacity = 2.0
    min_capacity = 0.5
  }

  tags = {
    Name        = "${var.project_name}-aurora-cluster-${var.environment}"
    Environment = var.environment
  }
}

# Instancia dentro del Cluster
resource "aws_rds_cluster_instance" "aurora_instance" {
  #checkov:skip=CKV_AWS_118: Enhanced monitoring requires dedicated IAM role, skipped for dev
  #checkov:skip=CKV_AWS_354: Performance Insights uses default encryption on free tier
  cluster_identifier           = aws_rds_cluster.aurora.id
  instance_class               = "db.serverless"
  engine                       = aws_rds_cluster.aurora.engine
  engine_version               = aws_rds_cluster.aurora.engine_version
  auto_minor_version_upgrade   = true
  performance_insights_enabled = true

  tags = {
    Name        = "${var.project_name}-aurora-instance-${var.environment}"
    Environment = var.environment
  }
}

# Almacenar credenciales en AWS Secrets Manager para el backend
resource "aws_secretsmanager_secret" "db_credentials" {
  #checkov:skip=CKV_AWS_149: Using default AWS encryption, KMS CMK adds cost for dev
  #checkov:skip=CKV2_AWS_57: Automatic rotation requires Lambda, DB credentials managed by Terraform
  name        = "${var.project_name}-db-credentials-${var.environment}"
  description = "Credenciales de Aurora PostgreSQL para ContaPRO"
}

resource "aws_secretsmanager_secret_version" "db_credentials_version" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username     = aws_rds_cluster.aurora.master_username
    password     = aws_rds_cluster.aurora.master_password
    engine       = "postgres"
    host         = aws_rds_cluster.aurora.endpoint
    port         = aws_rds_cluster.aurora.port
    dbname       = aws_rds_cluster.aurora.database_name
    DATABASE_URL = "postgresql://${aws_rds_cluster.aurora.master_username}:${random_password.db_password.result}@${aws_rds_cluster.aurora.endpoint}:${aws_rds_cluster.aurora.port}/${aws_rds_cluster.aurora.database_name}?schema=public"
  })
}
