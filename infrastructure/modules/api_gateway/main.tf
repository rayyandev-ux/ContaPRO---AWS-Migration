# =============================================================================
# Módulo API GATEWAY: HTTP API v2 + VPC Link
#
# Es el punto de entrada público para el backend. Recibe las peticiones
# de internet, aplica throttling (1000 rps) y las envía al ALB interno
# a través de un VPC Link (tráfico privado, nunca sale de la red de AWS).
#
# Flujo: Internet → API Gateway → VPC Link → ALB (interno) → ECS Fargate
# =============================================================================

# --- VPC Link: conecta API Gateway con el ALB dentro de la VPC ---
# Crea ENIs (interfaces de red) en las subnets privadas para alcanzar el ALB
resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "${var.project_name}-vpc-link-${var.environment}"
  security_group_ids = [var.vpc_link_sg_id]
  subnet_ids         = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-vpc-link-${var.environment}"
    Environment = var.environment
  }
}

# --- HTTP API (API Gateway v2) ---
# Más barato y rápido que REST API v1. Soporta VPC Link nativo a ALB.
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  # CORS: permite al frontend (CloudFront) hacer peticiones al backend.
  # En producción, restringir allowed_origins al dominio del frontend.
  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers     = ["Authorization", "Content-Type"]
    expose_headers    = ["*"]
    max_age           = 3600
    allow_credentials = false
  }

  tags = {
    Name        = "${var.project_name}-api-gateway-${var.environment}"
    Environment = var.environment
  }
}

# --- Integración: redirige TODO el tráfico al ALB vía VPC Link ---
resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  # El listener del ALB recibe el tráfico
  integration_uri = var.alb_listener_arn
  connection_type = "VPC_LINK"
  connection_id   = aws_apigatewayv2_vpc_link.main.id
}

# --- Ruta catch-all: cualquier método + cualquier path → ALB ---
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

# --- Stage: auto-deploy habilitado + throttling ---
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  # Throttling: 1000 rps con burst de 500
  # Si se sobrepasa, API Gateway devuelve 429 (Too Many Requests)
  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 1000
  }

  # Logs de acceso (opcional, requiere un log group)
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = {
    Name        = "${var.project_name}-api-stage-${var.environment}"
    Environment = var.environment
  }
}

# --- CloudWatch Log Group para API Gateway ---
resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${var.project_name}-api-${var.environment}"
  retention_in_days = 14

  tags = {
    Environment = var.environment
  }
}

# --- Dominio personalizado (solo cuando enable_custom_domain = true) ---
resource "aws_apigatewayv2_domain_name" "backend" {
  count       = var.enable_custom_domain ? 1 : 0
  domain_name = "backend.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = "${var.project_name}-api-domain-${var.environment}"
    Environment = var.environment
  }
}

# Mapear el dominio personalizado al stage
resource "aws_apigatewayv2_api_mapping" "backend" {
  count       = var.enable_custom_domain ? 1 : 0
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.backend[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

# Registro DNS A para backend.contapro.lat → API Gateway
resource "aws_route53_record" "backend" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "backend.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.backend[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.backend[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
