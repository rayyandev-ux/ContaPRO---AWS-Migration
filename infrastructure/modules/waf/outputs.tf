output "web_acl_arn" {
  description = "ARN del Web ACL (se asocia a CloudFront)"
  value       = aws_wafv2_web_acl.main.arn
}
