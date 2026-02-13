.PHONY: build run dev test clean docker-build docker-run migrate lint tidy azure-setup azure-deploy azure-logs

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

dev:
	$(HOME)/go/bin/air

test:
	go test ./... -v

clean:
	rm -rf bin/

docker-build:
	docker build -t loto-server .

docker-run:
	docker run --env-file .env -p 8080:8080 loto-server

migrate:
	psql "$(DATABASE_URL)" -f migrations/001_init.sql

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

# Azure deployment targets
azure-setup:
	bash scripts/setup-azure.sh

azure-deploy:
	bash scripts/deploy-azure.sh

azure-logs:
	@. .env.azure 2>/dev/null && az webapp log tail --resource-group $$RESOURCE_GROUP --name $$APP_SERVICE_NAME || echo "Configure .env.azure first"

azure-config:
	@echo "View app settings:" && \
	. .env.azure 2>/dev/null && \
	az webapp config appsettings list --resource-group $$RESOURCE_GROUP --name $$APP_SERVICE_NAME || echo "Configure .env.azure first"

azure-restart:
	@. .env.azure 2>/dev/null && az webapp restart --resource-group $$RESOURCE_GROUP --name $$APP_SERVICE_NAME && echo "App restarted" || echo "Configure .env.azure first"

azure-health:
	@. .env.azure 2>/dev/null && curl -s https://$$APP_SERVICE_NAME.azurewebsites.net/health | jq . || echo "Configure .env.azure first"

azure-cleanup:
	@. .env.azure 2>/dev/null && az group delete --name $$RESOURCE_GROUP --yes && echo "Resources deleted" || echo "Configure .env.azure first"

.PHONY: help
help:
	@echo "Loto Backend - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Run with hot-reload (air)"
	@echo "  make build            - Build binary"
	@echo "  make run              - Run binary"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Lint code"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container"
	@echo ""
	@echo "Azure Deployment:"
	@echo "  make azure-setup      - Create Azure resources (RG, ACR, App Service)"
	@echo "  make azure-deploy     - Build, push, and deploy to App Service"
	@echo "  make azure-logs       - View app logs in real-time"
	@echo "  make azure-config     - Show app configuration"
	@echo "  make azure-restart    - Restart App Service"
	@echo "  make azure-health     - Check health endpoint"
	@echo "  make azure-cleanup    - Delete all Azure resources"
	@echo ""
	@echo "Other:"
	@echo "  make clean            - Remove build artifacts"
	@echo "  make migrate          - Run database migrations"
	@echo "  make tidy             - Tidy go.mod"
