# =============================================================================
# Módulo FRONTEND: S3 + CloudFront + WAF
#
# S3: almacena los archivos estáticos generados por `next build` (output: export)
# CloudFront: CDN global con HTTPS, WAF y rewrite de URLs para Next.js
# WAF: protege contra rate limiting y ataques comunes (OWASP)
# =============================================================================

# --- S3 Bucket para el frontend estático ---
resource "aws_s3_bucket" "frontend" {
  #checkov:skip=CKV_AWS_18: Access logging requires dedicated logging bucket, skipped for dev
  #checkov:skip=CKV_AWS_144: Cross-region replication not needed for dev
  #checkov:skip=CKV_AWS_145: Using default S3 encryption (SSE-S3), KMS adds cost
  #checkov:skip=CKV2_AWS_62: S3 event notifications not needed for static frontend assets
  bucket        = "${var.project_name}-frontend-${var.environment}"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-frontend-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Bloquear acceso público directo a S3 (todo el tráfico debe pasar por CloudFront)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# OAC: permite a CloudFront leer objetos del bucket sin hacerlos públicos
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac-${var.environment}"
  description                       = "OAC for Frontend S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# --- CloudFront Function: rewrite de URLs para Next.js static export ---
# Next.js exporta /es.html, /es/dashboard.html, etc.
# El navegador pide /es o /es/dashboard → esta función añade .html
resource "aws_cloudfront_function" "rewrite_urls" {
  name    = "${var.project_name}-rewrite-urls-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Reescribe rutas de Next.js static export a .html en S3"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri === '/' || uri === '') {
        return {
          statusCode: 302,
          statusDescription: 'Found',
          headers: { location: { value: '/es' } }
        };
      }

      if (uri.endsWith('/')) {
        uri = uri.slice(0, -1);
      }

      var lastSegment = uri.split('/').pop();
      if (!lastSegment.includes('.')) {
        uri = uri + '.html';
      }

      request.uri = uri;
      return request;
    }
  EOT
}

# --- CloudFront Distribution ---
resource "aws_cloudfront_distribution" "frontend" {
  #checkov:skip=CKV_AWS_86: Access logging requires dedicated S3 bucket, skipped for dev
  #checkov:skip=CKV_AWS_310: Origin failover requires secondary origin, not needed for dev
  #checkov:skip=CKV_AWS_374: Geo restriction not required, app serves LATAM region without blocking
  #checkov:skip=CKV_AWS_305: Default root object conflicts with CloudFront Function URL rewrite (/ -> /es)
  #checkov:skip=CKV_AWS_174: When using cloudfront_default_certificate, minimum_protocol_version is fixed to TLSv1 by AWS
  #checkov:skip=CKV2_AWS_47: WAF already includes AWSManagedRulesKnownBadInputsRuleSet which covers Log4j
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  enabled         = true
  is_ipv6_enabled = true

  # Dominio personalizado (solo cuando enable_custom_domain = true)
  aliases = var.enable_custom_domain ? ["app.${var.domain_name}"] : []

  # WAF Web ACL (protección contra rate limiting y ataques)
  web_acl_id = var.waf_web_acl_arn

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    # Política de caché administrada: "CachingOptimized"
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # AWS Managed Response Headers Policy: SecurityHeadersPolicy
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"

    viewer_protocol_policy = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite_urls.arn
    }
  }

  # Páginas de error: servir 404.html generado por Next.js
  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
  }

  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado SSL: ACM si hay dominio personalizado, default de CloudFront si no
  viewer_certificate {
    cloudfront_default_certificate = var.enable_custom_domain ? false : true
    acm_certificate_arn            = var.enable_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = var.enable_custom_domain ? "sni-only" : null
    minimum_protocol_version       = var.enable_custom_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-${var.environment}"
    Environment = var.environment
  }
}

# Bucket Policy: solo CloudFront puede leer objetos
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontServicePrincipal"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
        }
      }
    }]
  })
}

# --- Route 53: registro DNS para app.contapro.lat → CloudFront ---
resource "aws_route53_record" "frontend" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}
