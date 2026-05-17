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