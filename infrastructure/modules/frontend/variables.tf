variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

# --- WAF ---
variable "waf_web_acl_arn" {
  description = "ARN del Web ACL de WAF (protección del frontend)"
  type        = string
}

# --- Custom domain ---
variable "enable_custom_domain" {
  type    = bool
  default = false
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 (para CloudFront)"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "ID de la Hosted Zone de Route 53"
  type        = string
  default     = ""
}
