# Loto Backend - Azure Deployment Setup

**Status**: ✅ Ready to deploy

This project is now fully configured for production deployment on Microsoft Azure using containers.

---

## 📖 Where to Start?

### 🏃 **I want to deploy NOW** (5 minutes)
→ See [QUICK_START.md](./QUICK_START.md)
- Copy & paste commands
- Step-by-step walkthrough
- Verify your deployment

### 📚 **I want to understand the setup**
→ See [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- What was created
- How it works
- Next steps

### 🔧 **I need detailed instructions**
→ See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)
- Complete setup guide
- Troubleshooting
- Monitoring setup
- GitHub Actions CI/CD

### 📋 **I need reference docs**
→ See [azure-deployment.md](./azure-deployment.md)
- Full deployment scripts
- Database setup
- Key Vault integration
- Cost estimates

---

## 🚀 30-Second Summary

Your Go backend is ready for Azure:

```bash
# 1. Prepare config (copy template)
cp .env.azure.example .env.azure
nano .env.azure  # Edit resource names

# 2. Create Azure resources (2-3 min)
bash scripts/setup-azure.sh

# 3. Configure environment variables
az webapp config appsettings set \
  --resource-group loto-rg \
  --name loto-app \
  --settings OPENAI_API_KEY="..." DB_HOST="..."

# 4. Deploy (3-5 min)
bash scripts/deploy-azure.sh

# 5. Done! Verify:
curl https://loto-app.azurewebsites.net/health
```

---

## 📦 What's Included

### Docker
- **Dockerfile**: Multi-stage build, ~23 MB optimized image
- **.dockerignore**: Excludes unnecessary files

### Deployment Scripts
- **setup-azure.sh**: Creates all Azure resources in one command
- **deploy-azure.sh**: Builds, pushes, and deploys new versions
- **azure-secrets-setup.sh**: Configures GitHub Actions (optional)

### CI/CD
- **.github/workflows/azure-deploy.yml**: Automatic deployment on git push

### Configuration
- **.env.azure.example**: Template for Azure variables
- **azure-app-service.json**: App Service configuration reference

### Documentation
- **QUICK_START.md**: Quick commands (this file)
- **DEPLOYMENT_SUMMARY.md**: What was done & next steps
- **AZURE_DEPLOYMENT.md**: Complete guide with troubleshooting
- **azure-deployment.md**: Detailed instructions with examples

---

## 🎯 Key Features

✅ **Optimized Docker Image**
- Multi-stage build (23 MB final size)
- Non-root user for security
- Alpine Linux base
- Health check endpoint

✅ **One-Command Setup**
- Creates Resource Group
- Creates Container Registry (ACR)
- Creates App Service Plan
- Creates Web App

✅ **One-Command Deployment**
- Builds Docker image
- Pushes to Azure Container Registry
- Updates App Service
- Auto-restart

✅ **GitHub Actions CI/CD**
- Automatic deployment on `git push main`
- Docker layer caching
- Health check verification

✅ **Security Best Practices**
- Non-root container user
- Minimal Alpine base
- No secrets in image
- Environment-based configuration

---

## 💰 Costs

| Service | SKU | Monthly |
|---------|-----|---------|
| App Service | B1 | $11.50 |
| Container Registry | Basic | $5.00 |
| **Total Minimum** | | **$16.50** |

**Production**: Upgrade to S1 ($55) or S2 ($110)

---

## 📋 Command Reference

### Makefile Targets
```bash
# Create Azure resources
make azure-setup

# Deploy application
make azure-deploy

# View logs
make azure-logs

# View configuration
make azure-config

# Restart application
make azure-restart

# Check health
make azure-health

# Delete all resources
make azure-cleanup
```

### Azure CLI (Direct)
```bash
# Create resource group
az group create --name loto-rg --location eastus

# Create container registry
az acr create --resource-group loto-rg --name lotoregistry --sku Basic

# View logs
az webapp log tail --resource-group loto-rg --name loto-app

# Restart app
az webapp restart --resource-group loto-rg --name loto-app
```

---

## 🔐 Security Checklist

- [x] Non-root user in Docker image
- [x] Minimal Alpine base
- [x] Multi-stage build
- [ ] Configure Key Vault (optional)
- [ ] Enable Managed Identity (optional)
- [ ] HTTPS only (recommended)
- [ ] Application Insights (optional)
- [ ] Network security rules (if using VNet)

---

## 🐛 Troubleshooting Quick Links

**App won't start?**
```bash
az webapp log tail --resource-group loto-rg --name loto-app
```

**Health check failing?**
```bash
curl -v https://loto-app.azurewebsites.net/health
```

**Image not pulling?**
```bash
az acr repository list --name lotoregistry
az acr credential show --name lotoregistry
```

See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md#-troubleshooting) for more solutions.

---

## 🔄 CI/CD Setup (Optional)

For automatic deployment on every `git push`:

1. Create Azure service principal:
   ```bash
   az ad sp create-for-rbac --name "loto-deploy" --role contributor \
     --scopes /subscriptions/{subscription-id}
   ```

2. Add GitHub repository secrets:
   ```bash
   bash scripts/azure-secrets-setup.sh
   ```

3. Push to deploy:
   ```bash
   git push origin main
   ```

---

## 📊 Monitoring

### Logs
```bash
az webapp log tail --resource-group loto-rg --name loto-app
```

### Metrics
```bash
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/loto-rg/providers/Microsoft.Web/sites/loto-app \
  --metric "Http4xx" "Http5xx" "ResponseTime" "CpuPercentage"
```

### Application Insights (optional)
```bash
az monitor app-insights component create \
  --app loto-insights \
  --location eastus \
  --resource-group loto-rg \
  --application-type web
```

---

## 🔗 Important Files

| File | Purpose |
|------|---------|
| [Dockerfile](./Dockerfile) | Container image definition |
| [scripts/setup-azure.sh](./scripts/setup-azure.sh) | Create Azure resources |
| [scripts/deploy-azure.sh](./scripts/deploy-azure.sh) | Deploy application |
| [.github/workflows/azure-deploy.yml](./.github/workflows/azure-deploy.yml) | GitHub Actions pipeline |
| [.env.azure.example](./.env.azure.example) | Configuration template |
| [QUICK_START.md](./QUICK_START.md) | Quick commands |
| [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) | Complete guide |
| [azure-deployment.md](./azure-deployment.md) | Detailed instructions |

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Created `.env.azure` from template
- [ ] Azure CLI installed and logged in
- [ ] Ran `scripts/setup-azure.sh` successfully
- [ ] Configured environment variables (API keys, DB credentials)
- [ ] Ran `scripts/deploy-azure.sh` successfully
- [ ] Health check passing: `curl https://loto-app.azurewebsites.net/health`
- [ ] Logs look good: `make azure-logs`
- [ ] (Optional) GitHub Actions secrets configured
- [ ] (Optional) Application Insights enabled
- [ ] (Optional) Backup configured

---

## 📞 Help & Support

- **Quick commands**: [QUICK_START.md](./QUICK_START.md)
- **Setup details**: [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- **Full guide**: [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)
- **Detailed docs**: [azure-deployment.md](./azure-deployment.md)
- **Azure docs**: https://learn.microsoft.com/en-us/azure/

---

## 🎓 Learning Resources

- [Azure App Service Docs](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure Container Registry Docs](https://learn.microsoft.com/en-us/azure/container-registry/)
- [Azure CLI Docs](https://learn.microsoft.com/en-us/cli/azure/)
- [GitHub Actions Azure Login](https://github.com/Azure/login)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🚀 Next Steps

1. **Read** [QUICK_START.md](./QUICK_START.md) (2 minutes)
2. **Run** `bash scripts/setup-azure.sh` (2-3 minutes)
3. **Configure** environment variables
4. **Deploy** with `bash scripts/deploy-azure.sh` (3-5 minutes)
5. **Verify** with health check
6. **Monitor** with logs and metrics

**Total time: ~15 minutes for first deployment**

---

**Ready?** Start with [QUICK_START.md](./QUICK_START.md) 🚀
