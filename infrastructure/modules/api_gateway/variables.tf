variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

# Subnets donde el VPC Link crea sus ENIs (mismas que el ALB interno)
variable "private_subnet_ids" {
  description = "IDs de las subnets privadas para el VPC Link"
  type        = list(string)
}

# Security Group del VPC Link (debe permitir tráfico al ALB)
variable "vpc_link_sg_id" {
  description = "Security Group ID para el VPC Link"
  type        = string
}

# ARN del listener del ALB (el VPC Link envía tráfico aquí)
variable "alb_listener_arn" {
  description = "ARN del listener HTTP del ALB interno"
  type        = string
}

# --- Custom domain (opcional) ---

variable "enable_custom_domain" {
  description = "Crear dominio personalizado (backend.contapro.lat)"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Dominio base"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN del certificado ACM regional (para el custom domain)"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "ID de la Hosted Zone de Route 53"
  type        = string
  default     = ""
}
