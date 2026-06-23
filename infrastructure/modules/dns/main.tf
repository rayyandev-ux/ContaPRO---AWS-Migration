# =============================================================================
# Módulo DNS: Route 53 + ACM (certificados SSL) + SES (verificación de dominio)
#
# Crea:
#   - Hosted Zone para el dominio (contapro.lat)
#   - Certificado ACM en la región principal (para API Gateway)
#   - Certificado ACM en us-east-1 (obligatorio para CloudFront)
#   - Registros de validación DNS para ambos certificados
#   - Verificación de dominio en SES (para enviar emails)
#   - Registros DKIM para SES
#
# IMPORTANTE: después de crear la Hosted Zone, debes ir a GoDaddy y cambiar
# los nameservers del dominio a los que aparecen en el output `nameservers`.
# Hasta que no hagas eso, los certificados ACM quedarán en PENDING_VALIDATION.
# =============================================================================

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# --- Route 53: Hosted Zone ---
# Al crearse, AWS asigna 4 nameservers (ns-xxx.awsdns-xx.com)
# que debes configurar en GoDaddy como Custom Nameservers
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name        = "${var.project_name}-dns-${var.environment}"
    Environment = var.environment
  }
}

# --- ACM: Certificado regional (para API Gateway en us-east-2) ---
resource "aws_acm_certificate" "regional" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = {
    Name        = "${var.project_name}-cert-regional-${var.environment}"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --- ACM: Certificado global en us-east-1 (obligatorio para CloudFront) ---
resource "aws_acm_certificate" "cloudfront" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = {
    Name        = "${var.project_name}-cert-cloudfront-${var.environment}"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --- Registros CNAME para validar los certificados ACM ---
# AWS genera un CNAME por cada dominio del certificado.
# Ambos certs (regional y cloudfront) usan los MISMOS CNAMEs de validación.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.regional.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 300
  allow_overwrite = true
}

# --- Esperar validación de los certificados ---
# Solo se ejecuta cuando enable_custom_domain = true.
# Si los nameservers de GoDaddy no apuntan a Route 53 aún,
# terraform apply se queda esperando aquí indefinidamente (Ctrl+C para cancelar).
resource "aws_acm_certificate_validation" "regional" {
  count                   = var.enable_custom_domain ? 1 : 0
  certificate_arn         = aws_acm_certificate.regional.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_acm_certificate_validation" "cloudfront" {
  count                   = var.enable_custom_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# --- SES: Verificación de dominio para enviar emails ---
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [aws_ses_domain_identity.main.verification_token]
}

# --- SES: DKIM (autenticación de emails, reduce spam score) ---
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}
