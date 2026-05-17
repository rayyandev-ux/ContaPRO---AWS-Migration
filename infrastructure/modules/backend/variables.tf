variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod, etc.)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of IDs of public subnets (for ALB)"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of IDs of private subnets (for Fargate)"
  type        = list(string)
}

variable "alb_sg_id" {
  description = "Security Group ID for the ALB"
  type        = string
}

variable "ecs_sg_id" {
  description = "Security Group ID for the ECS Fargate tasks"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the backend container"
  type        = number
  default     = 8080
}

variable "uploads_bucket_name" {
  description = "Name of the S3 bucket used for file uploads"
  type        = string
}

variable "uploads_bucket_arn" {
  description = "ARN of the S3 bucket used for file uploads"
  type        = string
}

variable "db_credentials_secret_arn" {
  description = "ARN del secreto en AWS Secrets Manager que contiene las credenciales de la BD"
  type        = string
}

variable "redis_url" {
  description = "URL de conexión para ElastiCache Redis"
  type        = string
}