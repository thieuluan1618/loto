# Azure Deployment - Quick Start (Copy & Paste)

## 1️⃣ First Time Setup (5 minutes)

```bash
# Step 1: Copy Azure config template
cp .env.azure.example .env.azure

# Step 2: Edit with your desired Azure resource names
nano .env.azure
# Required:
# - RESOURCE_GROUP=loto-rg
# - REGISTRY_NAME=lotoregistry (must be globally unique, lowercase)
# - APP_SERVICE_NAME=loto-app (must be globally unique)
# - LOCATION=eastus

# Step 3: Create all Azure resources
bash scripts/setup-azure.sh
# ✅ Creates: Resource Group, Container Registry, App Service Plan, Web App
# Takes ~2-3 minutes

# Step 4: Set environment variables (API keys, DB credentials, etc.)
RESOURCE_GROUP=$(grep RESOURCE_GROUP .env.azure | cut -d= -f2)
APP_SERVICE_NAME=$(grep APP_SERVICE_NAME .env.azure | cut -d= -f2)

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings \
    OPENAI_API_KEY="sk-proj-..." \
    OPENAI_MODEL="gpt-5.2" \
    DB_HOST="mydb.postgres.database.azure.com" \
    DB_PORT=5432 \
    DB_USER="dbadmin" \
    DB_PASSWORD="SecurePassword123!" \
    DB_NAME="loto" \
    DB_SSLMODE="require"

# Step 5: Deploy
bash scripts/deploy-azure.sh
# ✅ Builds image, pushes to ACR, restarts app
# Takes ~3-5 minutes

# Step 6: Verify
curl https://loto-app.azurewebsites.net/health
```

**Done!** Your app is now live on Azure. 🚀

---

## 2️⃣ Subsequent Deployments (2 minutes)

### After code changes:
```bash
bash scripts/deploy-azure.sh
```

### Or via GitHub Actions (automatic):
```bash
git push origin main  # App deploys automatically
```

---

## 3️⃣ Useful Commands

```bash
# Check logs
make azure-logs

# View configuration
make azure-config

# Restart app
make azure-restart

# Check health
make azure-health

# Update environment variables
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings NEW_VAR="value"

# Delete everything (cleanup)
make azure-cleanup
```

---

## ⚙️ Environment Variables Reference

### Required
```bash
SERVER_PORT=8080
MAX_UPLOAD_SIZE_MB=5
AI_PROVIDER=openai  # or 'google'
```

### For OpenAI
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.2
```

### For Google Gemini
```bash
GOOGLE_API_KEY=your-api-key
GOOGLE_AI_MODEL=gemini-2.5-flash
```

### Database (Optional)
```bash
DB_HOST=mydb.postgres.database.azure.com
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=SecurePassword123!
DB_NAME=loto
DB_SSLMODE=require
```

---

## 🔗 Quick Links

- **Full Guide**: [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)
- **Setup Details**: [azure-deployment.md](./azure-deployment.md)
- **Troubleshooting**: [AZURE_DEPLOYMENT.md#-troubleshooting](./AZURE_DEPLOYMENT.md#-troubleshooting)
- **Cost Estimate**: [AZURE_DEPLOYMENT.md#-costs](./AZURE_DEPLOYMENT.md#-costs)

---

## 🆘 Troubleshooting

```bash
# App not responding?
az webapp log tail --resource-group loto-rg --name loto-app

# Health check failing?
curl -v https://loto-app.azurewebsites.net/health

# Check container settings
az webapp config container show \
  --resource-group loto-rg \
  --name loto-app

# Restart app
az webapp restart --resource-group loto-rg --name loto-app
```

---

## 📦 What's Included

- ✅ Optimized Dockerfile (23 MB image)
- ✅ One-command setup script
- ✅ One-command deploy script
- ✅ GitHub Actions CI/CD pipeline
- ✅ Complete documentation
- ✅ Security best practices

---

## 💰 Costs

| Service | Monthly |
|---------|---------|
| App Service (B1) | $11.50 |
| Container Registry | $5.00 |
| **Total Minimum** | **$16.50** |
| + PostgreSQL | +$50 |
| + App Insights | +$5 |

Upgrade to S1 ($55) or S2 ($110) for production workloads.

---

## ✅ Deployment Checklist

- [ ] `cp .env.azure.example .env.azure` and edit
- [ ] `bash scripts/setup-azure.sh` completed
- [ ] API keys & DB credentials configured
- [ ] `bash scripts/deploy-azure.sh` completed
- [ ] `curl https://loto-app.azurewebsites.net/health` returns 200
- [ ] (Optional) GitHub Actions secrets configured
- [ ] (Optional) Monitoring/Alerts setup

---

**Questions?** See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) or [azure-deployment.md](./azure-deployment.md)
