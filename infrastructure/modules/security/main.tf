# =============================================================================
# Módulo SECURITY: Security Groups
#
# Cadena de confianza (cada SG solo acepta tráfico del anterior):
#   VPC Link SG → ALB SG → ECS SG → Aurora SG / Redis SG
#
# El ALB ahora es INTERNO (no expuesto a internet).
# El punto de entrada público es API Gateway, que llega al ALB vía VPC Link.
# =============================================================================

# --- Security Group para el VPC Link de API Gateway ---
# Permite al API Gateway enviar tráfico al ALB a través del VPC Link
resource "aws_security_group" "vpc_link" {
  name        = "${var.project_name}-vpc-link-sg-${var.environment}"
  description = "SG para el VPC Link de API Gateway"
  vpc_id      = var.vpc_id

  # Salida: hacia el ALB en el puerto 80
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name        = "${var.project_name}-vpc-link-sg-${var.environment}"
    Environment = var.environment
  }
}

# --- Security Group para el ALB (ahora INTERNO) ---
# Solo acepta tráfico desde el VPC Link de API Gateway
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Allow traffic from API Gateway VPC Link only"
  vpc_id      = var.vpc_id

  # Entrada: solo desde el VPC Link (no desde internet)
  ingress {
    description     = "HTTP from API Gateway VPC Link"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.vpc_link.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-alb-sg-${var.environment}"
    Environment = var.environment
  }
}

# --- Security Group para ECS Fargate ---
# Solo acepta tráfico desde el ALB
resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg-${var.environment}"
  description = "Allow inbound traffic from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-ecs-sg-${var.environment}"
    Environment = var.environment
  }
}

# --- Security Group para Aurora PostgreSQL ---
# Solo acepta conexiones desde los contenedores ECS
resource "aws_security_group" "aurora" {
  name        = "${var.project_name}-aurora-sg-${var.environment}"
  description = "Security group for Aurora PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-aurora-sg-${var.environment}"
    Environment = var.environment
  }
}

# --- Security Group para ElastiCache Redis ---
# Solo acepta conexiones desde los contenedores ECS
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-redis-sg-${var.environment}"
    Environment = var.environment
  }
}
