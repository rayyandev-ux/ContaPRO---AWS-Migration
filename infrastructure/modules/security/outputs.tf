output "alb_sg_id" {
  description = "The ID of the Security Group for the ALB"
  value       = aws_security_group.alb.id
}

output "ecs_sg_id" {
  description = "The ID of the Security Group for ECS Fargate"
  value       = aws_security_group.ecs.id
}