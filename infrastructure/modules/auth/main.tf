# =============================================================================
# Módulo AUTH: Amazon Cognito (User Pool + App Client)
# Gestiona el registro, login y emisión de tokens JWT para el frontend.
# =============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # IMPORTANTE: el frontend hace signUp({ username: email }), es decir,
  # usa el email como nombre de usuario. Para eso se necesita
  # `username_attributes = ["email"]`.
  # (Con `alias_attributes` Cognito RECHAZA usernames con formato de email).
  username_attributes = ["email"]

  # Cognito envía automáticamente un código de verificación al email
  auto_verified_attributes = ["email"]

  # Política de contraseñas (alineada con la validación del frontend)
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }

  # Atributo estándar "name": el frontend lo envía en userAttributes al registrar
  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = true
    mutable             = true
  }

  tags = {
    Name        = "${var.project_name}-cognito-${var.environment}"
    Environment = var.environment
  }
}

# App Client que usa el frontend (Amplify Auth) para hablar con Cognito
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${var.project_name}-frontend-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # IMPORTANTE: false porque es una SPA (Next.js estático).
  # Un secreto no puede guardarse de forma segura en código del navegador.
  generate_secret = false

  # Flujos de autenticación permitidos:
  # - SRP: el que usa Amplify por defecto (no envía la contraseña en claro)
  # - REFRESH_TOKEN: para renovar la sesión
  # - USER_PASSWORD: fallback para login directo con usuario/contraseña
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}
