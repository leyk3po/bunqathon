#!/bin/bash
# Deploy backend container to Lightsail
# Usage: ./infra/scripts/deploy.sh
# Requires: aws CLI, docker, .env at repo root

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load env
if [ -f "$REPO_ROOT/.env" ]; then
  export $(grep -v '^#' "$REPO_ROOT/.env" | xargs)
fi

SERVICE_NAME="flashdrop-backend"
REGION="${AWS_REGION:-eu-central-1}"
IMAGE_TAG="flashdrop-backend:latest"

echo "==> Building Docker image..."
docker build -t "$IMAGE_TAG" "$REPO_ROOT/apps/api"

echo "==> Pushing image to Lightsail..."
aws lightsail push-container-image \
  --region "$REGION" \
  --service-name "$SERVICE_NAME" \
  --label backend \
  --image "$IMAGE_TAG"

# Get the image name that Lightsail assigned
LIGHTSAIL_IMAGE=$(aws lightsail get-container-images \
  --service-name "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'containerImages[0].image' \
  --output text)

echo "==> Deploying container ($LIGHTSAIL_IMAGE)..."
aws lightsail create-container-service-deployment \
  --region "$REGION" \
  --service-name "$SERVICE_NAME" \
  --containers "{
    \"backend\": {
      \"image\": \"$LIGHTSAIL_IMAGE\",
      \"environment\": {
        \"DATABASE_URL\": \"$DATABASE_URL\",
        \"BUNQ_API_KEY\": \"$BUNQ_API_KEY\",
        \"BUNQ_ENVIRONMENT\": \"${BUNQ_ENVIRONMENT:-sandbox}\",
        \"BUNQ_MONETARY_ACCOUNT_ID\": \"${BUNQ_MONETARY_ACCOUNT_ID:-}\",
        \"AWS_ACCESS_KEY_ID\": \"$AWS_ACCESS_KEY_ID\",
        \"AWS_SECRET_ACCESS_KEY\": \"$AWS_SECRET_ACCESS_KEY\",
        \"AWS_REGION\": \"$REGION\",
        \"S3_BUCKET_NAME\": \"$S3_BUCKET_NAME\",
        \"AI_API_KEY\": \"$AI_API_KEY\",
        \"PUBLIC_BACKEND_URL\": \"$PUBLIC_BACKEND_URL\"
      },
      \"ports\": {
        \"8000\": \"HTTP\"
      }
    }
  }" \
  --public-endpoint "{
    \"containerName\": \"backend\",
    \"containerPort\": 8000,
    \"healthCheck\": {
      \"path\": \"/health\",
      \"intervalSeconds\": 10,
      \"timeoutSeconds\": 5,
      \"successCodes\": \"200\"
    }
  }"

echo "==> Deployment triggered. Check status:"
echo "    aws lightsail get-container-service-deployments --service-name $SERVICE_NAME --region $REGION"
echo ""
echo "==> Service URL (use as PUBLIC_BACKEND_URL):"
aws lightsail get-container-services \
  --service-name "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'containerServices[0].url' \
  --output text
