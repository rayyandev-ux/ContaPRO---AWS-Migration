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

# Cluster de Aurora Serverless v2 (PostgreSQL)
resource "aws_rds_cluster" "aurora" {
  cluster_identifier     = "${var.project_name}-aurora-cluster-${var.environment}"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15.3"
  database_name          = "contapro"
  master_username        = "postgres"
  master_password        = random_password.db_password.result
  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [var.aurora_sg_id]
  skip_final_snapshot    = true # Cambiar a false en producción si deseas un snapshot final

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
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version

  tags = {
    Name        = "${var.project_name}-aurora-instance-${var.environment}"
    Environment = var.environment
  }
}

# Almacenar credenciales en AWS Secrets Manager para el backend
resource "aws_secretsmanager_secret" "db_credentials" {
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
