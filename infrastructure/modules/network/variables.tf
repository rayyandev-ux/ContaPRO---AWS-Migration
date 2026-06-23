variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  description = "Región de AWS (para los VPC endpoints)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block de la VPC"
  type        = string
  default     = "172.16.0.0/16"
}

variable "public_subnets_cidr" {
  description = "CIDRs de las subnets públicas"
  type        = list(string)
  default     = ["172.16.1.0/24", "172.16.2.0/24"]
}

variable "private_subnets_cidr" {
  description = "CIDRs de las subnets privadas"
  type        = list(string)
  default     = ["172.16.3.0/24", "172.16.4.0/24"]
}

variable "availability_zones" {
  description = "Zonas de disponibilidad"
  type        = list(string)
}
