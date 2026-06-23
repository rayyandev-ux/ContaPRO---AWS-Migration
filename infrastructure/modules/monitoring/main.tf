# =============================================================================
# Módulo MONITORING: CloudWatch Alarms + SNS
#
# Alertas automáticas cuando:
#   - ECS tiene menos tareas de las deseadas (contenedor caído)
#   - El ALB devuelve errores 5xx (backend con problemas)
#   - El ALB tarda más de 2 segundos en responder
#
# Las alertas se envían al topic SNS. Puedes suscribir un email o webhook.
# =============================================================================

# --- SNS Topic: destino de las alertas ---
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-${var.environment}"

  tags = {
    Name        = "${var.project_name}-alerts-${var.environment}"
    Environment = var.environment
  }
}

# --- Alarma: ECS tareas corriendo < deseadas ---
# Se activa cuando ECS no puede mantener el número deseado de tareas
# (contenedor crashea, falla healthcheck, no pasa el deploy, etc.)
# Evaluación: 2 minutos consecutivos → alerta
resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  alarm_name          = "${var.project_name}-ecs-low-tasks-${var.environment}"
  alarm_description   = "ECS tiene menos tareas de las deseadas (posible caída)"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.desired_task_count
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}

# --- Alarma: ALB errores 5xx > 10 en 5 minutos ---
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx-${var.environment}"
  alarm_description   = "ALB devolviendo muchos errores 5xx (backend con problemas)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}

# --- Alarma: Latencia del backend > 2 segundos ---
resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${var.project_name}-alb-high-latency-${var.environment}"
  alarm_description   = "Latencia del backend supera 2 segundos"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 2.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}
