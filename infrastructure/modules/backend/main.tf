# =============================================================================
# Módulo BACKEND: ECR + ECS Fargate + ALB (interno) + Auto Scaling + IAM
#
# El ALB es INTERNO (no expuesto a internet). El tráfico llega desde
# API Gateway a través de un VPC Link.
#
# Auto Scaling: mínimo 2 tareas (multi-AZ), máximo 4.
# Escala automáticamente por CPU > 70%.
# =============================================================================

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# --- ECR: registro de imágenes Docker ---
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend-${var.environment}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-ecr-${var.environment}"
    Environment = var.environment
  }
}

# --- ECS Cluster con Container Insights habilitado ---
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster-${var.environment}"

  # Container Insights: métricas detalladas por tarea (CPU, memoria, red)
  # Necesario para la alarma RunningTaskCount en el módulo monitoring
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-ecs-cluster-${var.environment}"
    Environment = var.environment
  }
}

# --- IAM: Execution Role (ECS usa este rol para descargar la imagen y secretos) ---
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-ecs-exec-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# --- IAM: Task Role (permisos del contenedor en runtime: SES, S3, Secrets) ---
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# Enviar emails vía SES
resource "aws_iam_policy" "ecs_ses_policy" {
  name = "${var.project_name}-ecs-ses-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_ses" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_ses_policy.arn
}

# Leer/escribir en el bucket de uploads (Presigned URLs)
resource "aws_iam_policy" "ecs_s3_uploads_policy" {
  name = "${var.project_name}-ecs-s3-uploads-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [var.uploads_bucket_arn, "${var.uploads_bucket_arn}/*"]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_s3_uploads" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_s3_uploads_policy.arn
}

# Secreto de aplicación: contiene API keys (Stripe, OpenAI, etc.)
# Terraform crea el contenedor vacío; los valores se cargan manualmente
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project_name}-app-secrets-${var.environment}"
  description = "API keys del backend (rellenar manualmente via CLI o consola)"
}

# Leer secretos (Execution Role para inyectar DATABASE_URL, Task Role para SDK)
resource "aws_iam_policy" "ecs_secrets_policy" {
  name = "${var.project_name}-ecs-secrets-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.db_credentials_secret_arn, aws_secretsmanager_secret.app_secrets.arn]
    }]
  })
}

# Execution Role: inyecta DATABASE_URL antes de arrancar el contenedor
resource "aws_iam_role_policy_attachment" "exec_secrets" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.ecs_secrets_policy.arn
}

# Task Role: la app descarga API keys en runtime (fetchAwsSecrets)
resource "aws_iam_role_policy_attachment" "task_secrets" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_secrets_policy.arn
}

# --- ALB INTERNO (no expuesto a internet) ---
# El tráfico llega desde API Gateway vía VPC Link, no desde internet
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-alb-${var.environment}"
    Environment = var.environment
  }
}

# Target Group: healthcheck en /api/health
resource "aws_lb_target_group" "main" {
  name        = "${var.project_name}-tg-${var.environment}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200-299"
  }
}

# Listener HTTP (puerto 80)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# --- CloudWatch Log Group ---
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.project_name}-backend-${var.environment}"
  retention_in_days = 30
}

# --- Task Definition ---
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "${var.project_name}-backend-container-${var.environment}"
    image     = "${aws_ecr_repository.backend.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = var.container_port
      hostPort      = var.container_port
      protocol      = "tcp"
    }]

    # Variables NO sensibles
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.container_port) },
      { name = "USE_AWS_SES", value = "true" },
      { name = "AWS_REGION", value = data.aws_region.current.region },
      { name = "S3_BUCKET_NAME", value = var.uploads_bucket_name },
      { name = "REDIS_URL", value = var.redis_url },
      { name = "QUEUES_ENABLED", value = "true" },
      { name = "COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id },
      { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id },
      { name = "COGNITO_REGION", value = data.aws_region.current.region },
      { name = "FRONTEND_URL", value = var.frontend_url },
      { name = "AWS_SECRETS_MANAGER_SECRET_ID", value = aws_secretsmanager_secret.app_secrets.name },
    ]

    # Secretos inyectados por ECS (Execution Role)
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = "${var.db_credentials_secret_arn}:DATABASE_URL::"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}-backend-${var.environment}"
        "awslogs-region"        = data.aws_region.current.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# --- ECS Service (2 tareas mínimo, multi-AZ) ---
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.main.arn
    container_name   = "${var.project_name}-backend-container-${var.environment}"
    container_port   = var.container_port
  }

  # Si falla un deploy, ECS hace rollback automático a la versión anterior
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http, aws_cloudwatch_log_group.ecs_logs]
}

# --- Auto Scaling: escala por CPU ---
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 4
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Si el CPU promedio supera 70%, ECS lanza tareas adicionales
resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.project_name}-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
