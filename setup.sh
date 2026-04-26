#!/usr/bin/env bash
# ============================================================
# Ticket Schmiede - Interactive Setup Script
# ============================================================
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

banner() {
  echo ""
  echo -e "${BLUE}${BOLD}"
  echo "  ████████╗██╗ ██████╗██╗  ██╗███████╗████████╗"
  echo "     ██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝"
  echo "     ██║   ██║██║     █████╔╝ █████╗     ██║   "
  echo "     ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   "
  echo "     ██║   ██║╚██████╗██║  ██╗███████╗   ██║   "
  echo "     ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   "
  echo ""
  echo "  ███████╗ ██████╗██╗  ██╗███╗   ███╗██╗███████╗██████╗ ███████╗"
  echo "  ██╔════╝██╔════╝██║  ██║████╗ ████║██║██╔════╝██╔══██╗██╔════╝"
  echo "  ███████╗██║     ███████║██╔████╔██║██║█████╗  ██║  ██║█████╗  "
  echo "  ╚════██║██║     ██╔══██║██║╚██╔╝██║██║██╔══╝  ██║  ██║██╔══╝  "
  echo "  ███████║╚██████╗██║  ██║██║ ╚═╝ ██║██║███████╗██████╔╝███████╗"
  echo "  ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚══════╝╚═════╝ ╚══════╝"
  echo -e "${NC}"
  echo -e "${BOLD}  IT-Dokumentation & Ticketsystem${NC}"
  echo ""
}

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${BLUE}▶ $*${NC}"; }

# Generate a random secure string
generate_secret() {
  local length="${1:-32}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 "$length" | tr -d '\n/+=' | head -c "$length"
  else
    tr -dc 'A-Za-z0-9!@#$%^&*' </dev/urandom | head -c "$length"
  fi
}

generate_hex() {
  local length="${1:-64}"
  if command -v openssl &>/dev/null; then
    openssl rand -hex $((length / 2))
  else
    tr -dc '0-9a-f' </dev/urandom | head -c "$length"
  fi
}

# Prompt with default value
prompt() {
  local varname="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local secret="${4:-false}"

  if [[ -n "$default_val" ]]; then
    echo -ne "${prompt_text} ${YELLOW}[${default_val}]${NC}: "
  else
    echo -ne "${prompt_text}: "
  fi

  if [[ "$secret" == "true" ]]; then
    read -rs input
    echo
  else
    read -r input
  fi

  if [[ -z "$input" && -n "$default_val" ]]; then
    eval "$varname='$default_val'"
  else
    eval "$varname='$input'"
  fi
}

# ============================================================
# Check Prerequisites
# ============================================================
check_prerequisites() {
  step "Checking prerequisites"

  local missing=()

  # Check Docker
  if ! command -v docker &>/dev/null; then
    missing+=("docker")
  else
    local docker_version
    docker_version=$(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
    success "Docker found: v${docker_version}"
  fi

  # Check Docker Compose
  if ! docker compose version &>/dev/null 2>&1; then
    if ! command -v docker-compose &>/dev/null; then
      missing+=("docker-compose")
    else
      warn "Using legacy docker-compose (v1). Consider upgrading to Docker Compose v2."
    fi
  else
    local compose_version
    compose_version=$(docker compose version --short 2>/dev/null)
    success "Docker Compose found: v${compose_version}"
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "The following required tools are missing: ${missing[*]}"
    echo ""
    echo -e "${BOLD}Installation instructions:${NC}"
    echo ""
    echo "  Docker (includes Docker Compose on Windows/Mac):"
    echo "    https://docs.docker.com/get-docker/"
    echo ""
    echo "  Linux (quick install):"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    echo "    newgrp docker"
    echo ""
    echo "  Docker Compose plugin (Linux):"
    echo "    sudo apt-get install docker-compose-plugin"
    echo ""
    exit 1
  fi
}

# ============================================================
# Interactive Configuration
# ============================================================
collect_config() {
  step "Configuration"
  echo "Please provide the following configuration values."
  echo "Press Enter to accept the suggested default values."
  echo ""

  # Database
  echo -e "${BOLD}Database Configuration:${NC}"
  prompt DB_USER    "  Database user"         "ticketschmiede"
  prompt DB_NAME    "  Database name"         "ticketschmiede"
  prompt DB_PASSWORD "  Database password (leave empty to generate)" ""

  if [[ -z "${DB_PASSWORD:-}" ]]; then
    DB_PASSWORD=$(generate_secret 24)
    info "Generated database password: ${YELLOW}${DB_PASSWORD}${NC}"
  fi

  echo ""
  echo -e "${BOLD}Security Configuration:${NC}"
  prompt JWT_SECRET "  Auth secret (leave empty to generate)" ""
  if [[ -z "${JWT_SECRET:-}" ]]; then
    JWT_SECRET=$(generate_secret 48)
    info "Generated auth secret."
  fi

  prompt ENCRYPTION_KEY "  Encryption key 64-char hex (leave empty to generate)" ""
  if [[ -z "${ENCRYPTION_KEY:-}" ]]; then
    ENCRYPTION_KEY=$(generate_hex 64)
    info "Generated encryption key."
  fi

  if [[ ${#ENCRYPTION_KEY} -ne 64 ]]; then
    error "Encryption key must be exactly 64 hex characters (32 bytes)."
    exit 1
  fi

  echo ""
  echo -e "${BOLD}Admin Account:${NC}"
  prompt ADMIN_EMAIL    "  Admin email"    "admin@ticketschmiede.de"
  prompt ADMIN_NAME     "  Admin name"     "Ticket Schmiede Admin"
  prompt ADMIN_PASSWORD "  Admin password (leave empty to generate)" "" "false"
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD=$(generate_secret 16)
    info "Generated admin password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo -e "${RED}${BOLD}  !! SAVE THIS PASSWORD NOW - it will not be shown again !!${NC}"
  fi

  echo ""
  echo -e "${BOLD}Application URL:${NC}"
  prompt APP_URL "  Public application URL" "http://localhost:3000"
}

# ============================================================
# Write .env file
# ============================================================
write_env_file() {
  step "Writing .env file"

  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    warn ".env file already exists. Creating backup: .env.backup"
    cp "${SCRIPT_DIR}/.env" "${SCRIPT_DIR}/.env.backup"
  fi

  cat > "${SCRIPT_DIR}/.env" <<EOF
# Generated by setup.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# DO NOT commit this file to version control!

NODE_ENV=production
NEXT_PUBLIC_APP_URL=${APP_URL}
NEXT_PUBLIC_APP_NAME=Ticket Schmiede

# Database
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public

# Authentication
AUTH_SECRET=${JWT_SECRET}

# Encryption (AES-256 for credentials)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=25

# MinIO S3
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=$(generate_secret 20)
S3_BUCKET=ticketschmiede
S3_REGION=eu-central-1

# Initial Admin
SEED_ADMIN_EMAIL=${ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}
SEED_ADMIN_NAME=${ADMIN_NAME}

# Security
SESSION_DURATION=28800
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15
AUDIT_LOG_RETENTION_DAYS=365
EOF

  chmod 600 "${SCRIPT_DIR}/.env"
  success ".env file created with secure permissions (600)"
}

# ============================================================
# Start Services
# ============================================================
start_services() {
  step "Starting Ticket Schmiede"

  cd "${SCRIPT_DIR}"

  info "Pulling/building Docker images..."
  if docker compose pull --quiet 2>/dev/null; then
    true
  fi

  info "Starting services..."
  docker compose up -d --build

  info "Waiting for services to be healthy..."
  local max_wait=120
  local waited=0
  local interval=5

  while [[ $waited -lt $max_wait ]]; do
    if docker compose ps | grep -q "healthy"; then
      local healthy_count
      healthy_count=$(docker compose ps | grep -c "healthy" || true)
      info "Healthy services: ${healthy_count}"
    fi

    # Check if app is responding
    if curl -sf "${APP_URL}/api/health" &>/dev/null; then
      success "Application is ready!"
      break
    fi

    sleep $interval
    waited=$((waited + interval))
    echo -ne "\r  Waiting... ${waited}s / ${max_wait}s"
  done

  echo ""

  if ! curl -sf "${APP_URL}/api/health" &>/dev/null; then
    warn "Application health check failed. Showing logs:"
    docker compose logs --tail=50 app
    exit 1
  fi
}

# ============================================================
# Print Summary
# ============================================================
print_summary() {
  echo ""
  echo -e "${GREEN}${BOLD}============================================================"
  echo "  Ticket Schmiede is running!"
  echo -e "============================================================${NC}"
  echo ""
  echo -e "  ${BOLD}Application URL:${NC}  ${BLUE}${APP_URL}${NC}"
  echo ""
  echo -e "  ${BOLD}Admin Login:${NC}"
  echo -e "    Email:    ${YELLOW}${ADMIN_EMAIL}${NC}"
  echo -e "    Password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
  echo ""
  echo -e "  ${RED}${BOLD}Important: Change the admin password after first login!${NC}"
  echo ""
  echo -e "  ${BOLD}Useful commands:${NC}"
  echo "    View logs:     docker compose logs -f"
  echo "    Stop:          docker compose down"
  echo "    Restart:       docker compose restart"
  echo "    DB backup:     docker compose exec postgres pg_dump -U ${DB_USER} ${DB_NAME} > backup.sql"
  echo ""
  echo -e "  ${BOLD}Configuration:${NC}  .env (keep this file secure!)"
  echo ""
}

# ============================================================
# Main
# ============================================================
main() {
  banner
  check_prerequisites
  collect_config
  write_env_file
  start_services
  print_summary
}

main "$@"
