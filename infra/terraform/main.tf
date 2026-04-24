terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5"
}

provider "aws" {
  region = var.aws_region
}

# --- S3: media uploads and generated assets ---

resource "aws_s3_bucket" "media" {
  bucket = var.s3_bucket_name
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "media_public_read" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_public_access_block.media]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

# --- IAM: backend S3 write access ---

resource "aws_iam_user" "backend" {
  name = "${var.app_name}-backend"
}

resource "aws_iam_access_key" "backend" {
  user = aws_iam_user.backend.name
}

resource "aws_iam_user_policy" "backend_s3" {
  name = "s3-readwrite"
  user = aws_iam_user.backend.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*"
        ]
      }
    ]
  })
}

# --- Lightsail: managed PostgreSQL database ---

resource "aws_lightsail_database" "postgres" {
  relational_database_name = "${var.app_name}-db"
  availability_zone        = "${var.aws_region}a"
  master_database_name     = "flashdrop"
  master_username          = "flashdrop"
  master_password          = var.db_password
  blueprint_id             = "postgres_15"
  bundle_id                = "micro_2_0"

  publicly_accessible      = false
  skip_final_snapshot      = true
}

# --- Lightsail: container service for FastAPI backend ---

resource "aws_lightsail_container_service" "backend" {
  name        = "${var.app_name}-backend"
  power       = "nano"
  scale       = 1
  is_disabled = false
}
