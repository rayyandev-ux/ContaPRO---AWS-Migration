variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_sg_id" {
  type = string
}

variable "ecs_sg_id" {
  type = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "uploads_bucket_name" {
  type = string
}

variable "uploads_bucket_arn" {
  type = string
}

variable "db_credentials_secret_arn" {
  type = string
}

variable "redis_url" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "frontend_url" {
  description = "URL pública del frontend (para CORS)"
  type        = string
}
