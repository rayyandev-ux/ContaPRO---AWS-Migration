output "uploads_bucket_id" {
  description = "The ID (name) of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "The ARN of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.arn
}