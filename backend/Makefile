-include .env
up:
	docker compose build && docker compose up -d

logs:
	docker compose logs -f

down:
	docker compose down

go:
	docker exec -it $(GO_CONTAINER_HOST) /bin/sh

db:
	docker exec -it $(POSTGRES_CONTAINER_HOST) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)