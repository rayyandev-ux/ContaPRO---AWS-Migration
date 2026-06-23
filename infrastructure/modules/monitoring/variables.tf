variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "ecs_cluster_name" {
  description = "Nombre del cluster ECS"
  type        = string
}

variable "ecs_service_name" {
  description = "Nombre del servicio ECS"
  type        = string
}

variable "alb_arn_suffix" {
  description = "Sufijo del ARN del ALB (para métricas de CloudWatch)"
  type        = string
}

variable "desired_task_count" {
  description = "Número deseado de tareas ECS (para la alarma de tareas bajas)"
  type        = number
  default     = 2
}
