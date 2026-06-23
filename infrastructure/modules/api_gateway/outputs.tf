# URL pública del API Gateway (la usa el frontend como NEXT_PUBLIC_API_BASE
# cuando no hay dominio personalizado configurado)
output "api_endpoint" {
  description = "URL pública del API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_id" {
  description = "ID del HTTP API"
  value       = aws_apigatewayv2_api.main.id
}
