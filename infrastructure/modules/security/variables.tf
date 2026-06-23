variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  description = "ID de la VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR de la VPC (para reglas de egress del VPC Link)"
  type        = string
}

variable "container_port" {
  description = "Puerto del contenedor ECS"
  type        = number
  default     = 8080
}
