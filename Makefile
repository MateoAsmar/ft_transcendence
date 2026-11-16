# Makefile for ft_transcendence
# Simplifies Docker Compose operations

.PHONY: help up down build rebuild clean frontend backend api-gateway profile-service friends-service stats-service game-session-service matchmaking-service database kafka zookeeper nginx logs ps 2fa restart stop

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
help:
	@echo "$(BLUE)ft_transcendence - Docker Management$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@echo "  $(YELLOW)make up$(NC)        - Start all containers"
	@echo "  $(YELLOW)make down$(NC)      - Stop and remove all containers"
	@echo "  $(YELLOW)make build$(NC)     - Build all containers"
	@echo "  $(YELLOW)make rebuild$(NC)   - Rebuild and restart all containers"
	@echo "  $(YELLOW)make clean$(NC)     - Stop containers and remove volumes"
	@echo ""
	@echo "$(GREEN)Individual container commands:$(NC)"
	@echo "  $(YELLOW)make frontend$(NC)              - Rebuild and restart frontend"
	@echo "  $(YELLOW)make backend$(NC)               - Rebuild gateway and domain services"
	@echo "  $(YELLOW)make api-gateway$(NC)           - Rebuild API gateway"
	@echo "  $(YELLOW)make profile-service$(NC)       - Rebuild profile service"
	@echo "  $(YELLOW)make friends-service$(NC)       - Rebuild friends service"
	@echo "  $(YELLOW)make stats-service$(NC)         - Rebuild stats service"
	@echo "  $(YELLOW)make game-session-service$(NC)  - Rebuild game session service"
	@echo "  $(YELLOW)make matchmaking-service$(NC)   - Rebuild matchmaking service"
	@echo "  $(YELLOW)make database$(NC)              - Rebuild database"
	@echo "  $(YELLOW)make kafka$(NC)                 - Rebuild Kafka broker"
	@echo "  $(YELLOW)make zookeeper$(NC)             - Rebuild Zookeeper"
	@echo "  $(YELLOW)make nginx$(NC)                 - Rebuild nginx"
	@echo ""
	@echo "$(GREEN)Utility commands:$(NC)"
	@echo "  $(YELLOW)make logs$(NC)      - Show logs from all containers"
	@echo "  $(YELLOW)make ps$(NC)        - Show status of all containers"
	@echo "  $(YELLOW)make 2fa$(NC)       - Show 2FA codes from logs"
	@echo "  $(YELLOW)make restart$(NC)   - Restart all containers without rebuilding"
	@echo "  $(YELLOW)make stop$(NC)      - Stop all containers without removing them"
	@echo ""

up:
	@echo "$(GREEN)Starting all containers...$(NC)"
	@mkdir -p database/dbdata
	docker compose up -d --build --force-recreate

down:
	@echo "$(RED)Stopping and removing all containers...$(NC)"
	docker compose down -v --remove-orphans

re: down up

clean:
	@echo "$(RED)Cleaning up containers and volumes...$(NC)"
	docker compose down -v --remove-orphans
	docker system prune -af
	@echo "$(GREEN)Cleanup complete!$(NC)"

fclean:
	@echo "$(RED)Cleaning up containers, volumes, and images...$(NC)"
	docker compose down -v --remove-orphans
	docker system prune -af --volumes
	@echo "$(GREEN)Full cleanup complete!$(NC)"

frontend:
	@echo "$(YELLOW)Rebuilding frontend container...$(NC)"
	docker compose stop frontend
	docker compose rm -f frontend
	docker compose up -d --build frontend --force-recreate
	@echo "$(GREEN)Frontend container rebuilt!$(NC)"

backend:
	@echo "$(YELLOW)Rebuilding API gateway and domain services...$(NC)"
	docker compose stop api-gateway profile-service friends-service stats-service game-session-service matchmaking-service
	docker compose rm -f api-gateway profile-service friends-service stats-service game-session-service matchmaking-service
	docker compose up -d --build api-gateway profile-service friends-service stats-service game-session-service matchmaking-service --force-recreate
	@echo "$(GREEN)Backend microservices rebuilt!$(NC)"

api-gateway:
	@echo "$(YELLOW)Rebuilding api-gateway container...$(NC)"
	docker compose stop api-gateway
	docker compose rm -f api-gateway
	docker compose up -d --build api-gateway --force-recreate
	@echo "$(GREEN)API gateway container rebuilt!$(NC)"

profile-service:
	@echo "$(YELLOW)Rebuilding profile-service container...$(NC)"
	docker compose stop profile-service
	docker compose rm -f profile-service
	docker compose up -d --build profile-service --force-recreate
	@echo "$(GREEN)Profile service container rebuilt!$(NC)"

friends-service:
	@echo "$(YELLOW)Rebuilding friends-service container...$(NC)"
	docker compose stop friends-service
	docker compose rm -f friends-service
	docker compose up -d --build friends-service --force-recreate
	@echo "$(GREEN)Friends service container rebuilt!$(NC)"

stats-service:
	@echo "$(YELLOW)Rebuilding stats-service container...$(NC)"
	docker compose stop stats-service
	docker compose rm -f stats-service
	docker compose up -d --build stats-service --force-recreate
	@echo "$(GREEN)Stats service container rebuilt!$(NC)"

game-session-service:
	@echo "$(YELLOW)Rebuilding game-session-service container...$(NC)"
	docker compose stop game-session-service
	docker compose rm -f game-session-service
	docker compose up -d --build game-session-service --force-recreate
	@echo "$(GREEN)Game session service container rebuilt!$(NC)"

matchmaking-service:
	@echo "$(YELLOW)Rebuilding matchmaking-service container...$(NC)"
	docker compose stop matchmaking-service
	docker compose rm -f matchmaking-service
	docker compose up -d --build matchmaking-service --force-recreate
	@echo "$(GREEN)Matchmaking service container rebuilt!$(NC)"

database:
	@echo "$(YELLOW)Rebuilding database container...$(NC)"
	@mkdir -p database/dbdata
	docker compose stop database
	docker compose rm -f database
	docker compose up -d --build database --force-recreate
	@echo "$(GREEN)Database container rebuilt!$(NC)"

kafka:
	@echo "$(YELLOW)Rebuilding kafka container...$(NC)"
	docker compose stop kafka
	docker compose rm -f kafka
	docker compose up -d --build kafka --force-recreate
	@echo "$(GREEN)Kafka container rebuilt!$(NC)"

zookeeper:
	@echo "$(YELLOW)Rebuilding zookeeper container...$(NC)"
	docker compose stop zookeeper
	docker compose rm -f zookeeper
	docker compose up -d --build zookeeper --force-recreate
	@echo "$(GREEN)Zookeeper container rebuilt!$(NC)"

nginx:
	@echo "$(YELLOW)Rebuilding nginx container...$(NC)"
	docker compose stop nginx
	docker compose rm -f nginx
	docker compose up -d --build nginx --force-recreate
	@echo "$(GREEN)Nginx container rebuilt!$(NC)"

logs:
	@echo "$(BLUE)Showing logs from all containers...$(NC)"
	docker compose logs -f

ps:
	@echo "$(BLUE)Container status:$(NC)"
	docker compose ps

2fa:
	@echo "$(BLUE)Searching for 2FA codes in logs...$(NC)"
	@docker compose logs | grep 2FA || echo "$(YELLOW)No 2FA codes found in logs$(NC)"

restart:
	@echo "$(YELLOW)Restarting all containers...$(NC)"
	docker compose restart
	@echo "$(GREEN)All containers restarted!$(NC)"

stop:
	@echo "$(YELLOW)Stopping all containers...$(NC)"
	docker compose stop
	@echo "$(GREEN)All containers stopped!$(NC)"

logs-frontend:
	@docker compose logs -f frontend

logs-api-gateway:
	@docker compose logs -f api-gateway

logs-profile:
	@docker compose logs -f profile-service

logs-friends:
	@docker compose logs -f friends-service

logs-stats:
	@docker compose logs -f stats-service

logs-game-session:
	@docker compose logs -f game-session-service

logs-matchmaking:
	@docker compose logs -f matchmaking-service

logs-database:
	@docker compose logs -f database

logs-nginx:
	@docker compose logs -f nginx

# Tournament-specific commands
tournament-logs:
	@echo "$(BLUE)Showing tournament-related logs...$(NC)"
	@docker compose logs game-session-service | grep -i "tournament\|join\|full" | tail -50

tournament-test:
	@echo "$(YELLOW)=== Tournament System Test Guide ===$(NC)"
	@echo "$(GREEN)1. Create Tournament:$(NC) Go to /tournament, create 4-player tournament"
	@echo "$(GREEN)2. Join Players:$(NC) Use 4 different browsers/devices"
	@echo "$(GREEN)3. Watch Logs:$(NC) make tournament-logs (in another terminal)"
	@echo "$(GREEN)4. Start Tournament:$(NC) Creator clicks 'Start Tournament'"
	@echo ""
	@echo "$(BLUE)Expected Logs:$(NC)"
	@echo "  ✅ Player X joined tournament (1/4)"
	@echo "  ✅ Player Y joined tournament (2/4)"
	@echo "  ✅ Player Z joined tournament (3/4)"
	@echo "  ✅ Player W joined tournament (4/4)"
	@echo "  🚫 Cancelled retry timers"
	@echo ""
	@echo "$(RED)Should NOT see:$(NC)"
	@echo "  ❌ Tournament is full (for existing players)"
