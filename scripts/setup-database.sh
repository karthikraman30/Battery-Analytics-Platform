#!/bin/bash
#
# Battery Analytics Platform - Database Setup Script
# This script sets up TimescaleDB via Docker/Colima and creates the SSH tunnel
# required for Node.js connections.
#
# Usage: ./setup-database.sh [start|stop|status|reset]
#

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PGDATA_DIR="$PROJECT_DIR/pgdata"
CONTAINER_NAME="timescaledb"
DB_NAME="battery_analytics"
DB_NAME_GROUPED="battery_analytics_grouped"
DB_NAME_FRIEND="battery_analytics_friend"
DB_USER="postgres"
DB_PASSWORD="postgres"
TUNNEL_PORT=5433
CONTAINER_PORT=5432

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_colima() {
    if ! colima status &>/dev/null; then
        log_info "Starting Colima..."
        colima start --cpu 2 --memory 4
        sleep 3
    else
        log_info "Colima is running"
    fi
}

start_container() {
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        log_info "Container '$CONTAINER_NAME' is already running"
    elif docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
        log_info "Starting existing container '$CONTAINER_NAME'..."
        docker start $CONTAINER_NAME
    else
        log_info "Creating new TimescaleDB container..."
        mkdir -p "$PGDATA_DIR"
        docker run -d \
            --name $CONTAINER_NAME \
            -p $CONTAINER_PORT:5432 \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_DB=$DB_NAME \
            -e POSTGRES_HOST_AUTH_METHOD=trust \
            -v "$PGDATA_DIR:/var/lib/postgresql/data" \
            timescale/timescaledb:latest-pg17
        
        log_info "Waiting for database to be ready..."
        sleep 5
    fi
}

setup_ssh_tunnel() {
    # Kill existing tunnel if any
    pkill -f "ssh.*${TUNNEL_PORT}:172.17.0.2:5432" 2>/dev/null || true
    
    # Get container IP
    CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_NAME 2>/dev/null)
    
    if [ -z "$CONTAINER_IP" ]; then
        log_error "Could not get container IP. Is the container running?"
        return 1
    fi
    
    log_info "Container IP: $CONTAINER_IP"
    log_info "Setting up SSH tunnel on port $TUNNEL_PORT..."
    
    # Create SSH tunnel using Colima's control socket
    ssh -F /dev/stdin -f -N -L ${TUNNEL_PORT}:${CONTAINER_IP}:5432 colima << SSHCONFIG
Host colima
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
  NoHostAuthenticationForLocalhost yes
  PreferredAuthentications publickey
  Compression no
  BatchMode yes
  IdentitiesOnly yes
  GSSAPIAuthentication no
  User $(whoami)
  ControlMaster auto
  ControlPath "$HOME/.colima/_lima/colima/ssh.sock"
  ControlPersist yes
  Hostname 127.0.0.1
  Port $(colima ssh-config | grep "Port" | awk '{print $2}')
SSHCONFIG
    
    sleep 1
    
    # Verify tunnel
    if lsof -i :$TUNNEL_PORT &>/dev/null; then
        log_info "SSH tunnel established on port $TUNNEL_PORT"
    else
        log_error "Failed to establish SSH tunnel"
        return 1
    fi
}

create_grouped_database() {
    log_info "Creating grouped database ($DB_NAME_GROUPED) if not exists..."
    
    # Check if database exists
    EXISTS=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME_GROUPED'" 2>/dev/null)
    
    if [ "$EXISTS" = "1" ]; then
        log_info "Database '$DB_NAME_GROUPED' already exists"
    else
        docker exec $CONTAINER_NAME psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME_GROUPED;" 2>/dev/null
        log_info "✓ Created database '$DB_NAME_GROUPED'"
    fi
}

verify_connection() {
    log_info "Testing database connection..."
    
    # Test via docker exec
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT 1" &>/dev/null; then
        log_info "✓ Docker exec connection works"
    else
        log_error "✗ Docker exec connection failed"
        return 1
    fi
    
    # Test TimescaleDB
    VERSION=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT installed_version FROM pg_available_extensions WHERE name = 'timescaledb';" 2>/dev/null | tr -d ' ')
    if [ -n "$VERSION" ]; then
        log_info "✓ TimescaleDB version: $VERSION"
    fi
    
    # Create grouped database
    create_grouped_database
}

stop_services() {
    log_info "Stopping services..."
    
    # Kill SSH tunnel
    pkill -f "ssh.*${TUNNEL_PORT}:172.17.0.2:5432" 2>/dev/null || true
    pkill -f "ssh.*${TUNNEL_PORT}:" 2>/dev/null || true
    
    # Stop container
    docker stop $CONTAINER_NAME 2>/dev/null || true
    
    log_info "Services stopped"
}

show_status() {
    echo ""
    echo "=== Battery Analytics Database Status ==="
    echo ""
    
    # Colima
    if colima status &>/dev/null; then
        echo -e "Colima:      ${GREEN}Running${NC}"
    else
        echo -e "Colima:      ${RED}Stopped${NC}"
    fi
    
    # Container
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        echo -e "Container:   ${GREEN}Running${NC}"
        CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_NAME 2>/dev/null)
        echo "             IP: $CONTAINER_IP"
    else
        echo -e "Container:   ${RED}Stopped${NC}"
    fi
    
    # SSH Tunnel
    if lsof -i :$TUNNEL_PORT &>/dev/null; then
        echo -e "SSH Tunnel:  ${GREEN}Active on port $TUNNEL_PORT${NC}"
    else
        echo -e "SSH Tunnel:  ${RED}Not active${NC}"
    fi
    
    # Database connection test (consolidated)
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT 1" &>/dev/null 2>&1; then
        TABLES=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ')
        echo -e "DB (consolidated): ${GREEN}Connected${NC} ($TABLES tables)"
    else
        echo -e "DB (consolidated): ${RED}Not accessible${NC}"
    fi
    
    # Database connection test (grouped)
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME_GROUPED -c "SELECT 1" &>/dev/null 2>&1; then
        TABLES_G=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME_GROUPED -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ')
        echo -e "DB (grouped):      ${GREEN}Connected${NC} ($TABLES_G tables)"
    else
        echo -e "DB (grouped):      ${YELLOW}Not initialized${NC}"
    fi
    
    # Database connection test (friend)
    if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME_FRIEND -c "SELECT 1" &>/dev/null 2>&1; then
        TABLES_F=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME_FRIEND -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ')
        echo -e "DB (friend):       ${GREEN}Connected${NC} ($TABLES_F tables)"
    else
        echo -e "DB (friend):       ${YELLOW}Not initialized${NC}"
    fi
    
    echo ""
    echo "Connection strings:"
    echo "  Docker exec:       docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    echo "  Consolidated:      postgresql://$DB_USER:$DB_PASSWORD@localhost:$TUNNEL_PORT/$DB_NAME"
    echo "  Grouped:           postgresql://$DB_USER:$DB_PASSWORD@localhost:$TUNNEL_PORT/$DB_NAME_GROUPED"
    echo "  Friend:            postgresql://$DB_USER:$DB_PASSWORD@localhost:$TUNNEL_PORT/$DB_NAME_FRIEND"
    echo ""
}

reset_database() {
    log_warn "This will delete all data. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        stop_services
        docker rm $CONTAINER_NAME 2>/dev/null || true
        rm -rf "$PGDATA_DIR"
        log_info "Database reset complete. Run './setup-database.sh start' to recreate."
    else
        log_info "Reset cancelled"
    fi
}

case "${1:-start}" in
    start)
        check_colima
        start_container
        setup_ssh_tunnel
        verify_connection
        show_status
        ;;
    stop)
        stop_services
        ;;
    status)
        show_status
        ;;
    reset)
        reset_database
        ;;
    tunnel)
        setup_ssh_tunnel
        ;;
    *)
        echo "Usage: $0 [start|stop|status|reset|tunnel]"
        echo ""
        echo "Commands:"
        echo "  start   - Start Colima, container, and SSH tunnel (default)"
        echo "  stop    - Stop container and tunnel"
        echo "  status  - Show current status"
        echo "  reset   - Delete all data and start fresh"
        echo "  tunnel  - Recreate SSH tunnel only"
        exit 1
        ;;
esac
