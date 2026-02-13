#!/bin/bash
set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Load configuration
if [ ! -f ".env.azure" ]; then
    log_error ".env.azure not found. Please create it with Azure variables."
    exit 1
fi

source .env.azure

# Validate required variables
required_vars=("RESOURCE_GROUP" "REGISTRY_NAME" "APP_SERVICE_NAME" "LOCATION")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Missing required variable: $var"
        exit 1
    fi
done

IMAGE_NAME="${IMAGE_NAME:-loto-server}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

log_info "Azure Deployment Script"
log_info "Resource Group: $RESOURCE_GROUP"
log_info "Registry: $REGISTRY_NAME"
log_info "App Service: $APP_SERVICE_NAME"
log_info "Image: $IMAGE_NAME:$IMAGE_TAG"

# 1. Build Docker image
log_info "Building Docker image..."
docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

# 2. Login to Azure
log_info "Logging in to Azure..."
az login --allow-no-subscriptions > /dev/null 2>&1 || true

# 3. Login to ACR
log_info "Logging in to Azure Container Registry..."
ACR_LOGIN=$(az acr login --name "$REGISTRY_NAME" --expose-token --query accessToken -o tsv)
echo "$ACR_LOGIN" | docker login "$REGISTRY_NAME.azurecr.io" -u "00000000-0000-0000-0000-000000000000" --password-stdin > /dev/null 2>&1 || log_warn "Docker login may have issues"

# 4. Tag and push image
log_info "Pushing image to ACR..."
docker tag "$IMAGE_NAME:$IMAGE_TAG" "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
docker push "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"

# 5. Update App Service with new image
log_info "Updating App Service..."
REGISTRY_URL="$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
REGISTRY_USERNAME=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query username -o tsv)
REGISTRY_PASSWORD=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query 'passwords[0].value' -o tsv)

az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$REGISTRY_URL" \
    --docker-registry-server-url "https://$REGISTRY_NAME.azurecr.io" \
    --docker-registry-server-user "$REGISTRY_USERNAME" \
    --docker-registry-server-password "$REGISTRY_PASSWORD"

# 6. Restart app service
log_info "Restarting App Service..."
az webapp restart \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME"

# 7. Wait for deployment
log_info "Waiting for deployment to complete (30s)..."
sleep 30

# 8. Check health
log_info "Checking application health..."
APP_URL="https://${APP_SERVICE_NAME}.azurewebsites.net/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" || echo "0")

if [ "$HTTP_STATUS" = "200" ]; then
    log_info "Deployment successful!"
    log_info "App URL: https://${APP_SERVICE_NAME}.azurewebsites.net"
else
    log_warn "App returned status $HTTP_STATUS. Check logs:"
    log_warn "az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME"
    exit 1
fi

log_info "Done!"
