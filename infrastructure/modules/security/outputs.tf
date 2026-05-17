output "alb_sg_id" {
  description = "The ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_sg_id" {
  description = "The ID of the ECS tasks security group"
  value       = aws_security_group.ecs.id
}

output "aurora_sg_id" {
  description = "The ID of the Aurora PostgreSQL security group"
  value       = aws_security_group.aurora.id
}

output "redis_sg_id" {
  description = "The ID of the ElastiCache Redis security group"
  value       = aws_security_group.redis.id
}