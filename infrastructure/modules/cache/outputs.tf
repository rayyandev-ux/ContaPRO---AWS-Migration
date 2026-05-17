output "redis_endpoint" {
  description = "El endpoint del cluster de ElastiCache Redis"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "El puerto de ElastiCache Redis"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].port
}

output "redis_url" {
  description = "La URL formateada para conectarse a Redis"
  value       = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
}
