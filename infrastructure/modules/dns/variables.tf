variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "domain_name" {
  description = "Dominio base (ej: contapro.lat)"
  type        = string
}

variable "enable_custom_domain" {
  description = "Esperar validación de certificados ACM (requiere DNS configurado)"
  type        = bool
  default     = false
}
