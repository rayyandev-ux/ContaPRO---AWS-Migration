output "vpc_link_sg_id" {
  description = "Security Group del VPC Link de API Gateway"
  value       = aws_security_group.vpc_link.id
}

output "alb_sg_id" {
  description = "Security Group del ALB"
  value       = aws_security_group.alb.id
}

output "ecs_sg_id" {
  description = "Security Group de ECS Fargate"
  value       = aws_security_group.ecs.id
}

output "aurora_sg_id" {
  description = "Security Group de Aurora PostgreSQL"
  value       = aws_security_group.aurora.id
}

output "redis_sg_id" {
  description = "Security Group de ElastiCache Redis"
  value       = aws_security_group.redis.id
}
