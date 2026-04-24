output "s3_bucket_name" {
  value = aws_s3_bucket.media.bucket
}

output "s3_bucket_url" {
  value = "https://${aws_s3_bucket.media.bucket}.s3.${var.aws_region}.amazonaws.com"
}

output "backend_iam_access_key_id" {
  value     = aws_iam_access_key.backend.id
  sensitive = true
}

output "backend_iam_secret_access_key" {
  value     = aws_iam_access_key.backend.secret
  sensitive = true
}

output "db_endpoint" {
  value     = aws_lightsail_database.postgres.master_endpoint_address
  sensitive = true
}

output "db_port" {
  value = aws_lightsail_database.postgres.master_endpoint_port
}

output "database_url" {
  value     = "postgresql+psycopg://flashdrop:${var.db_password}@${aws_lightsail_database.postgres.master_endpoint_address}:${aws_lightsail_database.postgres.master_endpoint_port}/flashdrop"
  sensitive = true
}

output "container_service_url" {
  value       = aws_lightsail_container_service.backend.url
  description = "Public HTTPS URL — use this as PUBLIC_BACKEND_URL and for bunq webhook registration"
}
