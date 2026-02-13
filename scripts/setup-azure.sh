#!/bin/bash
set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Azure Loto Backend Deployment Setup                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v az &> /dev/null; then
    log_error "Azure CLI not found. Install from: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

log_info "Prerequisites OK"

# Load or create .env.azure
if [ ! -f ".env.azure" ]; then
    log_warn "Creating .env.azure from template..."
    cp .env.azure.example .env.azure
    log_warn "Please edit .env.azure with your values"
    exit 1
fi

source .env.azure

# Validate
if [ -z "$RESOURCE_GROUP" ] || [ -z "$REGISTRY_NAME" ] || [ -z "$APP_SERVICE_NAME" ]; then
    log_error "Missing required variables in .env.azure"
    exit 1
fi

# Login to Azure
log_info "Logging in to Azure..."
az login --allow-no-subscriptions > /dev/null 2>&1 || true

SUBSCRIPTION=$(az account show --query name -o tsv)
log_info "Using subscription: $SUBSCRIPTION"

# Create Resource Group
log_info "Creating/checking resource group: $RESOURCE_GROUP"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

# Create Container Registry
log_info "Creating/checking container registry: $REGISTRY_NAME"
if ! az acr show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" > /dev/null 2>&1; then
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REGISTRY_NAME" \
        --sku Basic \
        --output none
else
    log_warn "Registry $REGISTRY_NAME already exists"
fi

# Create App Service Plan
log_info "Creating/checking app service plan..."
PLAN_NAME="${APP_SERVICE_NAME}-plan"
if ! az appservice plan show --resource-group "$RESOURCE_GROUP" --name "$PLAN_NAME" > /dev/null 2>&1; then
    az appservice plan create \
        --name "$PLAN_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --sku B1 \
        --is-linux \
        --output none
else
    log_warn "Plan $PLAN_NAME already exists"
fi

# Create Web App for Containers
log_info "Creating/checking web app: $APP_SERVICE_NAME"
if ! az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" > /dev/null 2>&1; then
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$PLAN_NAME" \
        --name "$APP_SERVICE_NAME" \
        --deployment-container-image-name-user "admin" \
        --output none
else
    log_warn "Web app $APP_SERVICE_NAME already exists"
fi

# Get ACR credentials
log_info "Configuring container settings..."
REGISTRY_USERNAME=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query username -o tsv)
REGISTRY_PASSWORD=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query 'passwords[0].value' -o tsv)

az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$REGISTRY_NAME.azurecr.io/${IMAGE_NAME:-loto-server}:latest" \
    --docker-registry-server-url "https://$REGISTRY_NAME.azurecr.io" \
    --docker-registry-server-user "$REGISTRY_USERNAME" \
    --docker-registry-server-password "$REGISTRY_PASSWORD" \
    --output none

# Configure basic settings
log_info "Configuring app settings..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --settings \
        SERVER_PORT=8080 \
        MAX_UPLOAD_SIZE_MB=5 \
        AI_PROVIDER=openai \
        WEBSITES_PORT=8080 \
    --output none

# Enable continuous deployment
log_info "Enabling continuous deployment..."
az webapp deployment container config \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --enable-cd true \
    --output none

log_info "Getting webhook URL..."
WEBHOOK_URL=$(az webapp deployment container show \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query deploymentUrl -o tsv)

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   Setup Complete!                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Resource Group: $RESOURCE_GROUP"
echo "📍 Registry: $REGISTRY_NAME"
echo "📍 Web App: $APP_SERVICE_NAME"
echo "📍 App URL: https://${APP_SERVICE_NAME}.azurewebsites.net"
echo ""
echo "🔗 Webhook URL (for ACR):"
echo "$WEBHOOK_URL"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   az webapp config appsettings set \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --name $APP_SERVICE_NAME \\"
echo "     --settings OPENAI_API_KEY='your-key' DB_HOST='your-host' ..."
echo ""
echo "2. Deploy your first image:"
echo "   bash scripts/deploy-azure.sh"
echo ""
echo "3. View logs:"
echo "   az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME"
echo ""
echo "4. (Optional) Setup GitHub Actions:"
echo "   - Add Azure credentials as repository secrets:"
echo "     - AZURE_CLIENT_ID"
echo "     - AZURE_TENANT_ID"
echo "     - AZURE_SUBSCRIPTION_ID"
echo "   - Push to main or production branch to trigger deployment"
echo ""
