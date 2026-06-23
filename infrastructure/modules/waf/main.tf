# =============================================================================
# Módulo WAF: Web Application Firewall
#
# Protege el frontend (CloudFront) con:
#   - Rate limiting: 10 rps por IP (3000 requests en ventana de 5 minutos)
#   - AWS Managed Rules: protección contra bots, SQL injection, XSS
#
# IMPORTANTE: scope CLOUDFRONT requiere que el Web ACL se cree en us-east-1.
# Por eso este módulo recibe el provider alias us_east_1.
# =============================================================================

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

resource "aws_wafv2_web_acl" "main" {
  provider    = aws.us_east_1
  name        = "${var.project_name}-waf-${var.environment}"
  description = "WAF para CloudFront: rate limiting + reglas de seguridad"
  scope       = "CLOUDFRONT"

  # Acción por defecto: permitir tráfico que no matchee ninguna regla
  default_action {
    allow {}
  }

  # --- Regla 1: Rate Limiting (10 rps por IP) ---
  # WAF evalúa en ventanas de 5 minutos: 10 rps × 300s = 3000 requests
  # Si una IP supera el límite, WAF la bloquea automáticamente hasta
  # que baje por debajo del umbral.
  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # --- Regla 2: AWS Managed Rules - Common Rule Set ---
  # Protege contra los ataques más comunes (OWASP Top 10)
  rule {
    name     = "aws-managed-common"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # --- Regla 3: AWS Managed Rules - Known Bad Inputs ---
  # Bloquea patrones de ataque conocidos (Log4j, etc.)
  rule {
    name     = "aws-managed-bad-inputs"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.project_name}-waf-${var.environment}"
    Environment = var.environment
  }
}
