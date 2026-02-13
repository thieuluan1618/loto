#!/bin/bash
set -e

# Setup GitHub Actions secrets for Azure deployment

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "Setting up GitHub Actions secrets for Azure deployment..."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    log_warn "GitHub CLI not found. Install from: https://cli.github.com/"
    echo ""
    echo "Or set secrets manually in repository:"
    echo "  Settings > Secrets and variables > Actions > New repository secret"
    echo ""
    echo "Required secrets:"
    echo "  - AZURE_SUBSCRIPTION_ID"
    echo "  - AZURE_TENANT_ID"
    echo "  - AZURE_CLIENT_ID"
    exit 0
fi

# Check if we're in a git repo with a remote
REPO=$(git config --get remote.origin.url | sed 's/.*[/:]\([^/]*\)\/\([^/]*\)\.git$/\1\/\2/')

if [ -z "$REPO" ]; then
    log_warn "Not in a git repository with remote"
    exit 1
fi

log_info "Repository: $REPO"
echo ""

echo "Getting Azure credentials..."
echo "Run: az ad sp create-for-rbac --role contributor --scopes /subscriptions/{subscription-id}"
echo ""

read -p "Enter AZURE_SUBSCRIPTION_ID: " SUBSCRIPTION_ID
read -p "Enter AZURE_TENANT_ID: " TENANT_ID
read -p "Enter AZURE_CLIENT_ID: " CLIENT_ID

echo ""
log_info "Setting GitHub repository secrets..."

gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID" --repo "$REPO"
gh secret set AZURE_TENANT_ID --body "$TENANT_ID" --repo "$REPO"
gh secret set AZURE_CLIENT_ID --body "$CLIENT_ID" --repo "$REPO"

log_info "Secrets configured!"
echo ""
echo "GitHub Actions is now ready to deploy to Azure."
echo "Secrets will be used in: .github/workflows/azure-deploy.yml"
