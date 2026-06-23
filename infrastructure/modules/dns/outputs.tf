# Nameservers: estos 4 valores debes configurarlos en GoDaddy
# (GoDaddy > DNS > Nameservers > Change > Custom)
output "nameservers" {
  description = "Nameservers de Route 53 (configurar en GoDaddy)"
  value       = aws_route53_zone.main.name_servers
}

output "hosted_zone_id" {
  description = "ID de la Hosted Zone de Route 53"
  value       = aws_route53_zone.main.zone_id
}

# Certificado en la región principal (para API Gateway)
output "regional_certificate_arn" {
  description = "ARN del certificado ACM regional (para API Gateway)"
  value       = aws_acm_certificate.regional.arn
}

# Certificado en us-east-1 (para CloudFront)
output "cloudfront_certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 (para CloudFront)"
  value       = aws_acm_certificate.cloudfront.arn
}
