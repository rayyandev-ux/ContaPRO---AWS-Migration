output "sns_topic_arn" {
  description = "ARN del topic SNS de alertas (suscribir email con: aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint tu@email.com)"
  value       = aws_sns_topic.alerts.arn
}
