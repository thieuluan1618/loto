# Azure Deployment - Complete Setup Guide

Quick reference for deploying Loto backend to Azure App Service.

## 🚀 5-Minute Quick Start

### 1. Prepare Azure credentials
```bash
# Copy template
cp .env.azure.example .env.azure

# Edit with your values
nano .env.azure  # or your editor
```

### 2. Run setup script (creates all resources)
```bash
bash scripts/setup-azure.sh
```

### 3. Configure secrets (environment variables)
```bash
az webapp config appsettings set \
  --resource-group $(grep RESOURCE_GROUP .env.azure | cut -d= -f2) \
  --name $(grep APP_SERVICE_NAME .env.azure | cut -d= -f2) \
  --settings \
    OPENAI_API_KEY="sk-..." \
    OPENAI_MODEL="gpt-5.2" \
    DB_HOST="your-db.postgres.database.azure.com" \
    DB_PORT=5432 \
    DB_USER="dbadmin" \
    DB_PASSWORD="SecurePass123!"
```

### 4. Deploy
```bash
bash scripts/deploy-azure.sh
```

### 5. Verify
```bash
curl https://loto-app.azurewebsites.net/health
```

Done! ✅

---

## 📋 Files Overview

| File | Purpose |
|------|---------|
| **Dockerfile** | Multi-stage build, optimized for Azure (23 MB image) |
| **.dockerignore** | Excludes unnecessary files from build context |
| **azure-deployment.md** | Detailed deployment instructions with examples |
| **scripts/setup-azure.sh** | Creates all Azure resources (RG, ACR, App Service) |
| **scripts/deploy-azure.sh** | Builds and pushes Docker image, restarts app |
| **scripts/azure-secrets-setup.sh** | Sets up GitHub Actions secrets (optional) |
| **.github/workflows/azure-deploy.yml** | GitHub Actions CI/CD pipeline |
| **.env.azure.example** | Template for Azure deployment config |
| **azure-app-service.json** | App Service configuration reference |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Azure Portal                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │   App Service (loto-app)                    │   │
│  │   ├─ Container: loto-server:latest          │   │
│  │   ├─ Plan: B1/S1 Linux                      │   │
│  │   └─ Health Check: /health (8080)           │   │
│  └──────────────────────────────────────────────┘   │
│                       ▲                              │
│                       │ pulls                        │
│  ┌──────────────────────────────────────────────┐   │
│  │   Container Registry (lotoregistry.acr)      │   │
│  │   └─ loto-server:latest                      │   │
│  └──────────────────────────────────────────────┘   │
│                       ▲                              │
│                       │ push                         │
│  ┌──────────────────────────────────────────────┐   │
│  │   GitHub Actions (optional)                 │   │
│  │   └─ Builds & pushes on push to main        │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │   Database (optional)                       │   │
│  │   └─ PostgreSQL on Azure Database           │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 💰 Costs

| Service | SKU | Monthly Cost |
|---------|-----|-------------|
| App Service Plan | B1 | $11.50 |
| Container Registry | Basic | $5.00 |
| **Total Minimum** | - | **~$16.50** |
| PostgreSQL (100GB) | Basic | ~$50 |
| Application Insights | Standard | ~$5-10 |

For production workloads, upgrade to **S1 or S2** (~$55-110/month).

---

## 🔐 Security Best Practices

### 1. Use Managed Identity
```bash
az webapp identity assign \
  --resource-group loto-rg \
  --name loto-app
```

### 2. Store secrets in Key Vault (recommended)
```bash
az keyvault create \
  --resource-group loto-rg \
  --name loto-kv

az keyvault secret set \
  --vault-name loto-kv \
  --name openai-api-key \
  --value "sk-..."
```

### 3. Enable HTTPS only
```bash
az webapp update \
  --resource-group loto-rg \
  --name loto-app \
  --set httpsOnly=true
```

### 4. Use minimal Docker image
- Multi-stage build: Go binary only (23 MB)
- Non-root user: `app:app`
- Alpine base: Minimal surface area
- No secrets in image: Use environment variables

---

## 📊 Monitoring

### View logs in real-time
```bash
az webapp log tail \
  --resource-group loto-rg \
  --name loto-app \
  --tail 50
```

### Download logs
```bash
az webapp log download \
  --resource-group loto-rg \
  --name loto-app \
  --log-file logs.zip
```

### Check metrics
```bash
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/loto-rg/providers/Microsoft.Web/sites/loto-app \
  --metric "Http4xx" "Http5xx" "ResponseTime" "CpuPercentage"
```

### Setup Application Insights
```bash
# Create insights
az monitor app-insights component create \
  --app loto-insights \
  --location eastus \
  --resource-group loto-rg \
  --application-type web

# Get key
KEY=$(az monitor app-insights component show \
  --app loto-insights \
  --resource-group loto-rg \
  --query instrumentationKey -o tsv)

# Configure app
az webapp config appsettings set \
  --resource-group loto-rg \
  --name loto-app \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$KEY
```

---

## 🔄 CI/CD Setup (GitHub Actions)

### 1. Create Service Principal
```bash
# Create service principal for Azure
az ad sp create-for-rbac \
  --name "loto-deploy" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}

# Output will contain: appId, password, tenant
```

### 2. Add GitHub Secrets
```bash
# Via CLI
bash scripts/azure-secrets-setup.sh

# Or manually in GitHub:
# Settings > Secrets and variables > Actions
# Add:
#   - AZURE_CLIENT_ID
#   - AZURE_TENANT_ID
#   - AZURE_SUBSCRIPTION_ID
```

### 3. Trigger deployment
```bash
git push origin main  # or production branch
```

---

## 📦 Manual Deployment

### Build locally
```bash
docker build -t loto-server:latest .
```

### Push to ACR
```bash
az acr login --name lotoregistry
docker tag loto-server:latest lotoregistry.azurecr.io/loto-server:latest
docker push lotoregistry.azurecr.io/loto-server:latest
```

### Deploy via script
```bash
bash scripts/deploy-azure.sh
```

### Deploy via CLI
```bash
az webapp config container set \
  --resource-group loto-rg \
  --name loto-app \
  --docker-custom-image-name lotoregistry.azurecr.io/loto-server:latest \
  --docker-registry-server-url https://lotoregistry.azurecr.io

az webapp restart \
  --resource-group loto-rg \
  --name loto-app
```

---

## 🐛 Troubleshooting

### App won't start
```bash
# Check logs
az webapp log tail --resource-group loto-rg --name loto-app

# Restart
az webapp restart --resource-group loto-rg --name loto-app

# Check container settings
az webapp config container show --resource-group loto-rg --name loto-app
```

### Health check failing
```bash
# Check if endpoint is accessible
curl -v https://loto-app.azurewebsites.net/health

# If 404, ensure `/health` endpoint exists in main.go
# Check logs for errors
```

### ACR image not pulling
```bash
# Verify image exists
az acr repository list --name lotoregistry

az acr repository show --name lotoregistry --repository loto-server

# Check credentials
az acr credential show --name lotoregistry
```

### Environment variables not applying
```bash
# Restart app after changing settings
az webapp restart --resource-group loto-rg --name loto-app

# Verify settings applied
az webapp config appsettings list \
  --resource-group loto-rg \
  --name loto-app
```

---

## 🗑️ Cleanup

Delete all Azure resources:
```bash
az group delete --name loto-rg --yes
```

---

## 📚 Related Docs

- **Detailed guide**: [azure-deployment.md](./azure-deployment.md)
- **Docker reference**: [Dockerfile](./Dockerfile)
- **App Service config**: [azure-app-service.json](./azure-app-service.json)
- **Environment vars**: [.env.azure.example](./.env.azure.example)

---

## ✅ Deployment Checklist

- [ ] `.env.azure` configured with your values
- [ ] Azure CLI installed and logged in
- [ ] Docker installed
- [ ] Ran `scripts/setup-azure.sh` successfully
- [ ] Configured environment variables (API keys, DB credentials)
- [ ] First deployment successful: `scripts/deploy-azure.sh`
- [ ] Health check passing: `curl https://loto-app.azurewebsites.net/health`
- [ ] (Optional) GitHub Actions secrets configured
- [ ] (Optional) Application Insights enabled
- [ ] (Optional) Database backup configured

---

## 📞 Need Help?

- [Azure CLI Reference](https://learn.microsoft.com/en-us/cli/azure/)
- [App Service Docs](https://learn.microsoft.com/en-us/azure/app-service/)
- [Container Registry Docs](https://learn.microsoft.com/en-us/azure/container-registry/)
- [GitHub Actions Azure Login](https://github.com/Azure/login)

