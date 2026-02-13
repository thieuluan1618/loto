# Azure Deployment Guide - Loto Backend

## Prerequisites
- Azure CLI installed (`az --version`)
- Docker installed locally
- Azure subscription with appropriate permissions
- GitHub repo with SSH/HTTPS access

## Quick Start - 10 Minutes

### 1. Create Azure Resources
```bash
#!/bin/bash
set -e

# Set variables
RESOURCE_GROUP="loto-rg"
REGISTRY_NAME="lotoregistry"  # Must be globally unique, lowercase, no hyphens
LOCATION="eastus"
APP_SERVICE_PLAN="loto-plan"
APP_SERVICE_NAME="loto-app"
IMAGE_NAME="loto-server"

# Login to Azure
az login

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create container registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $REGISTRY_NAME \
  --sku Basic

# Create App Service plan (Linux)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

# Create Web App for Containers
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $APP_SERVICE_NAME \
  --deployment-container-image-name-user admin

# Configure container settings
az webapp config container set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:latest" \
  --docker-registry-server-url "https://$REGISTRY_NAME.azurecr.io" \
  --docker-registry-server-user "$(az acr credential show --resource-group $RESOURCE_GROUP --name $REGISTRY_NAME --query username -o tsv)" \
  --docker-registry-server-password "$(az acr credential show --resource-group $RESOURCE_GROUP --name $REGISTRY_NAME --query 'passwords[0].value' -o tsv)"

# Enable continuous deployment (optional)
az webapp deployment container config \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --enable-cd true

echo "✅ Azure resources created successfully!"
echo "📍 App URL: https://$APP_SERVICE_NAME.azurewebsites.net"
```

### 2. Build & Push Docker Image
```bash
#!/bin/bash
RESOURCE_GROUP="loto-rg"
REGISTRY_NAME="lotoregistry"
IMAGE_NAME="loto-server"
IMAGE_TAG="latest"

# Login to ACR
az acr login --name $REGISTRY_NAME

# Build locally first
docker build -t $IMAGE_NAME:$IMAGE_TAG .

# Tag for ACR
docker tag $IMAGE_NAME:$IMAGE_TAG "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"

# Push to ACR
docker push "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"

echo "✅ Image pushed to $REGISTRY_NAME.azurecr.io"
```

### 3. Configure Environment Variables
```bash
RESOURCE_GROUP="loto-rg"
APP_SERVICE_NAME="loto-app"

# Set app settings (environment variables)
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings \
    SERVER_PORT=8080 \
    MAX_UPLOAD_SIZE_MB=5 \
    AI_PROVIDER=openai \
    OPENAI_API_KEY="your-openai-key" \
    OPENAI_MODEL="gpt-5.2" \
    DB_HOST="your-db-host.postgres.database.azure.com" \
    DB_PORT=5432 \
    DB_USER="your-db-user" \
    DB_PASSWORD="your-db-password" \
    DB_NAME="loto" \
    DB_SSLMODE="require" \
    GOOGLE_VISION_ENABLED="false"

echo "✅ Environment variables configured"
```

### 4. Deploy
```bash
RESOURCE_GROUP="loto-rg"
APP_SERVICE_NAME="loto-app"

# Restart app to pull latest image
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME

# Check logs
az webapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME

echo "✅ App deployed! Visit: https://$APP_SERVICE_NAME.azurewebsites.net/health"
```

## Production Best Practices

### 1. Database Setup (Azure Database for PostgreSQL)
```bash
RESOURCE_GROUP="loto-rg"
LOCATION="eastus"
DB_SERVER="loto-db-server"
DB_USER="dbadmin"

# Create PostgreSQL server
az postgres server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER \
  --location $LOCATION \
  --admin-user $DB_USER \
  --admin-password "SecurePassword123!" \
  --sku-name B_Gen5_1 \
  --storage-size 51200 \
  --backup-retention 7 \
  --geo-redundant-backup Enabled

# Create database
az postgres db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER \
  --name loto

# Get connection string
az postgres server connection-string show \
  --server-name $DB_SERVER \
  --admin-user $DB_USER
```

### 2. Key Vault for Secrets (Recommended)
```bash
RESOURCE_GROUP="loto-rg"
VAULT_NAME="loto-kv"

# Create Key Vault
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $VAULT_NAME \
  --enable-rbac-authorization

# Store secrets
az keyvault secret set \
  --vault-name $VAULT_NAME \
  --name "openai-api-key" \
  --value "your-openai-key"

az keyvault secret set \
  --vault-name $VAULT_NAME \
  --name "db-password" \
  --value "your-db-password"

# Configure App Service to access Key Vault via Managed Identity
az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME

# Grant access to Key Vault
PRINCIPAL_ID=$(az webapp identity show --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME --query principalId -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $PRINCIPAL_ID \
  --scope "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$VAULT_NAME"
```

### 3. CI/CD Pipeline (GitHub Actions)
See `.github/workflows/azure-deploy.yml`

### 4. Application Insights (Monitoring)
```bash
RESOURCE_GROUP="loto-rg"
APP_INSIGHTS_NAME="loto-insights"
APP_SERVICE_NAME="loto-app"

# Create Application Insights
az monitor app-insights component create \
  --app $APP_INSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)

# Link to App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

## Environment Variables Reference

### Required
- `SERVER_PORT`: Port to run on (default: 8080)
- `MAX_UPLOAD_SIZE_MB`: Max upload size in MB (default: 5)
- `AI_PROVIDER`: `openai` or `google`

### For OpenAI
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model name (e.g., `gpt-5.2`)

### For Google Gemini
- `GOOGLE_API_KEY`: Your Google API key
- `GOOGLE_AI_MODEL`: Model name (e.g., `gemini-2.5-flash`)

### For Google Cloud Vision
- `GOOGLE_VISION_ENABLED`: `true` or `false`
- `GOOGLE_VISION_CREDENTIALS`: Path to service account JSON (set via startup script)

### Database (Optional - app runs without DB)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (5432)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `DB_SSLMODE`: `require` for production, `disable` for dev

## Monitoring & Troubleshooting

### View Logs
```bash
# Real-time logs
az webapp log tail \
  --resource-group loto-rg \
  --name loto-app

# Download logs
az webapp log download \
  --resource-group loto-rg \
  --name loto-app \
  --log-file logs.zip
```

### Health Check
```bash
curl https://loto-app.azurewebsites.net/health
```

### Restart App
```bash
az webapp restart \
  --resource-group loto-rg \
  --name loto-app
```

### View Metrics
```bash
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/loto-rg/providers/Microsoft.Web/sites/loto-app \
  --metric "Http4xx" "Http5xx" "ResponseTime"
```

## Cleanup

```bash
# Delete all resources
az group delete --name loto-rg --yes
```

## Links
- [Azure CLI Docs](https://learn.microsoft.com/en-us/cli/azure/)
- [App Service Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)
- [PostgreSQL Pricing](https://azure.microsoft.com/en-us/pricing/details/postgresql/)
