variable "aws_region" {
  default = "eu-central-1"
}

variable "app_name" {
  default = "flashdrop"
}

variable "s3_bucket_name" {
  description = "Must be globally unique"
  default     = "flashdrop-media-hackathon"
}

variable "db_password" {
  description = "Lightsail PostgreSQL master password"
  sensitive   = true
}
