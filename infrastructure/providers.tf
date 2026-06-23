# =============================================================================
# Providers de Terraform
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # Provider principal: crea toda la infraestructura en la región elegida
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    # Genera la contraseña aleatoria de Aurora PostgreSQL
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Provider principal (us-east-2 por defecto)
provider "aws" {
  profile = var.profile
  region  = var.region
}

# Provider en us-east-1: obligatorio para recursos globales.
# CloudFront y WAF (scope CLOUDFRONT) SOLO aceptan certificados ACM
# y Web ACLs creados en us-east-1, sin importar la región principal.
provider "aws" {
  alias   = "us_east_1"
  profile = var.profile
  region  = "us-east-1"
}
