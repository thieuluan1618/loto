.PHONY: build run dev test clean docker-build docker-run migrate

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
