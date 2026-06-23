variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

# 10 rps × 300 segundos (ventana de evaluación de WAF) = 3000
variable "rate_limit" {
  description = "Máximo de requests por IP en ventana de 5 minutos"
  type        = number
  default     = 3000
}
