# =============================================================================
# Variables globales del proyecto
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto (prefijo de todos los recursos AWS)"
  type        = string
  default     = "contapro"
}

variable "environment" {
  description = "Entorno de despliegue (dev, prod)"
  type        = string
  default     = "dev"
}

# Región principal: us-east-2 (Ohio) como indica el diagrama de arquitectura
variable "region" {
  description = "Región principal de AWS"
  type        = string
  default     = "us-east-2"
}

variable "profile" {
  description = "Perfil de AWS CLI (~/.aws/credentials)"
  type        = string
  default     = "default"
}

# Dominio base registrado en GoDaddy
variable "domain_name" {
  description = "Dominio base (ej: contapro.lat). Route 53 gestionará su DNS."
  type        = string
  default     = "contapro.lat"
}

# Habilitar DESPUÉS de cambiar los nameservers en GoDaddy a los de Route 53.
# Sin esto, los certificados ACM quedan en PENDING_VALIDATION y terraform apply
# se queda esperando indefinidamente.
variable "enable_custom_domain" {
  description = "Activar dominio personalizado en CloudFront y API Gateway (requiere que DNS ya apunte a Route 53)"
  type        = bool
  default     = false
}
