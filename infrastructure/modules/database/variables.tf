variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod, etc.)"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Aurora"
  type        = list(string)
}

variable "aurora_sg_id" {
  description = "Security Group ID for Aurora"
  type        = string
}
