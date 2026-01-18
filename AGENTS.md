# AGENTS.md - Battery Analytics Platform

## Project Overview
Smartphone Battery & Usage Analytics Platform analyzing Android telemetry data from ~300 users over 7-14 days each.

## Tech Stack
- **Database**: TimescaleDB 2.24.0 (PostgreSQL 17 via Docker/Colima)
- **Backend**: Bun + Elysia (TypeScript)
- **Frontend**: React + Vite + shadcn/ui + Recharts
- **Data Processing**: TypeScript/Bun scripts

## Directory Structure
```
/Users/karthikraman/Workspace/bmp_data/
├── server/                 # Bun + Elysia backend
├── client/                 # React + shadcn/ui frontend
├── scripts/                # Data consolidation & loading scripts
│   ├── setup-database.sh   # Database setup script (START HERE)
│   ├── init-schema.ts      # Schema initialization
│   ├── load-db.ts          # Data loading (consolidated data)
│   ├── load-grouped-db.ts  # Data loading (grouped data)
│   ├── consolidate.ts      # CSV consolidation (original)
│   └── consolidate-grouped.ts  # CSV consolidation (grouped data)
├── consolidated_data/      # Consolidated CSV files (original)
├── consolidated_grouped_data/  # Consolidated CSV files (grouped)
├── grouped_data/           # Raw grouped data (36 groups)
├── pgdata/                 # PostgreSQL data directory (Docker volume)
├── prompt.md               # Detailed project requirements
└── AGENTS.md               # This file
```

## ⚠️ IMPORTANT: Database Connection

Due to Colima's port forwarding limitations with PostgreSQL authentication, we use an **SSH tunnel** to connect:

- **Docker container port**: 5432 (inside Colima VM)
- **SSH tunnel port**: 5433 (localhost, for Node.js connections)
- **Direct access**: Use `docker exec` for psql commands

## Quick Start

### 1. Start Database (REQUIRED FIRST)
```bash
cd /Users/karthikraman/Workspace/bmp_data

# Start Colima, Docker container, and SSH tunnel
./scripts/setup-database.sh start

# Check status
./scripts/setup-database.sh status
```

### 2. Initialize Schema (First time only)
```bash
cd scripts
DB_PORT=5433 bun run init-schema.ts
```

### 3. Load Data (First time only)
```bash
cd scripts

# Load consolidated data (original)
DB_PORT=5433 bun run load-db.ts

# Load grouped data (36 groups)
DB_PORT=5433 bun run consolidate-grouped.ts  # First consolidate
DB_PORT=5433 bun run load-grouped-db.ts      # Then load
```

### 4. Start Backend
```bash
cd server
bun install
bun run dev
# Server runs on http://localhost:3001
```

### 5. Start Frontend
```bash
cd client
bun install
bun run dev
# Frontend runs on http://localhost:5173
```

## Database Setup (Detailed)

### Setup Script Commands
```bash
./scripts/setup-database.sh start   # Start everything (default)
./scripts/setup-database.sh stop    # Stop container and tunnel
./scripts/setup-database.sh status  # Show current status
./scripts/setup-database.sh reset   # Delete all data and start fresh
./scripts/setup-database.sh tunnel  # Recreate SSH tunnel only
```

### Manual Setup (if script fails)
```bash
# 1. Start Colima
colima start --cpu 2 --memory 4

# 2. Create/Start container
docker run -d \
  --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=battery_analytics \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v /Users/karthikraman/Workspace/bmp_data/pgdata:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg17

# 3. Get container IP
CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' timescaledb)

# 4. Create SSH tunnel (CRITICAL for Node.js connections)
ssh -F /dev/stdin -f -N -L 5433:${CONTAINER_IP}:5432 colima << 'SSHEOF'
Host colima
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
  User $(whoami)
  ControlMaster auto
  ControlPath "$HOME/.colima/_lima/colima/ssh.sock"
  ControlPersist yes
  Hostname 127.0.0.1
  Port $(colima ssh-config | grep "Port" | awk '{print $2}')
SSHEOF

# 5. Test connection
docker exec timescaledb psql -U postgres -d battery_analytics -c "SELECT version();"
```

### Connection Strings
```bash
# For Node.js/Bun applications (via SSH tunnel)
postgresql://postgres:postgres@localhost:5433/battery_analytics

# For docker exec (direct)
docker exec timescaledb psql -U postgres -d battery_analytics

# Environment variables
DB_HOST=localhost
DB_PORT=5433
DB_NAME=battery_analytics
DB_USER=postgres
DB_PASSWORD=postgres
```

## Build & Run Commands

### Backend (server/)
```bash
cd server
bun install          # Install dependencies
bun run dev          # Development server (port 3001)
bun test             # Run tests
bun run typecheck    # Type check
bun run build        # Build for production
```

### Frontend (client/)
```bash
cd client
bun install          # Install dependencies
bun run dev          # Development server (port 5173)
bun run build        # Build for production
bun run preview      # Preview production build
bun run lint         # Lint code
```

### Data Scripts (scripts/)
```bash
cd scripts
bun run consolidate.ts              # Consolidate CSV files
bun run consolidate-grouped.ts      # Consolidate grouped CSV files
DB_PORT=5433 bun run init-schema.ts # Initialize database schema
DB_PORT=5433 bun run load-db.ts     # Load data into database
DB_PORT=5433 bun run load-grouped-db.ts # Load grouped data into database
```

## Environment Variables

### Backend (.env in server/)
```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=battery_analytics
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
NODE_ENV=development
```

### Frontend (.env in client/)
```env
VITE_API_URL=http://localhost:3001/api
```

## Code Style Guidelines

### TypeScript
- Use strict mode (`strict: true` in tsconfig)
- Prefer `const` over `let`, never use `var`
- Use explicit return types for functions
- Use interfaces for object shapes, types for unions/primitives
- Use async/await over raw Promises
- Handle errors explicitly with try/catch

### Naming Conventions
- **Files**: kebab-case (`battery-time-series.tsx`)
- **Components**: PascalCase (`BatteryTimeSeries`)
- **Functions/Variables**: camelCase (`getBatteryData`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Database columns**: snake_case (`battery_level`)
- **Types/Interfaces**: PascalCase (`BatteryEvent`, `ChargingSession`)

### React Components
- Functional components with hooks only
- Props interface named `{ComponentName}Props`
- Use shadcn/ui components from `@/components/ui`
- Colocate styles with components using Tailwind CSS
- Use React Query for server state management

### API Design
- RESTful endpoints under `/api/` (consolidated) and `/api/grouped/` (grouped data)
- Frontend toggle defaults to grouped data
- Use query parameters for filters (`?device_id=X&start_date=Y`)
- Return JSON with consistent structure: `{ data, error?, meta? }`
- HTTP status codes: 200 (success), 400 (bad request), 500 (server error)

## Database Schema

### Tables (TimescaleDB Hypertables)
```sql
battery_events          -- Raw battery readings (25K+ rows)
charging_sessions       -- Derived charging sessions (6K+ rows)
app_usage_events        -- Foreground app events (200K+ rows)
network_events          -- Network connectivity events (200K+ rows)
sensor_events           -- Sensor readings

-- Support tables
user_profiles           -- Computed user behavior profiles
aggregate_statistics    -- Global statistics cache
```

### Key Relationships
- Device ID extracted from file/folder names
- Group ID extracted from parent folder
- All timestamps in IST (+05:30), stored as TIMESTAMPTZ

## Useful Commands

```bash
# Check all services
./scripts/setup-database.sh status

# Quick database query
docker exec timescaledb psql -U postgres -d battery_analytics -c "SELECT COUNT(*) FROM battery_events;"

# View table counts
docker exec timescaledb psql -U postgres -d battery_analytics -c "
  SELECT 'battery_events' as table_name, COUNT(*) FROM battery_events
  UNION ALL SELECT 'charging_sessions', COUNT(*) FROM charging_sessions
  UNION ALL SELECT 'app_usage_events', COUNT(*) FROM app_usage_events
  UNION ALL SELECT 'network_events', COUNT(*) FROM network_events;
"

# View TimescaleDB logs
docker logs -f timescaledb

# Restart SSH tunnel only
./scripts/setup-database.sh tunnel
```

## Troubleshooting

### "password authentication failed" from Node.js
This is the Colima port forwarding issue. Fix:
```bash
# Recreate SSH tunnel
./scripts/setup-database.sh tunnel

# Or restart everything
./scripts/setup-database.sh stop
./scripts/setup-database.sh start
```

### Connection timeout
```bash
# Check if tunnel is running
lsof -i :5433

# Check if container is running
docker ps | grep timescaledb

# Restart services
./scripts/setup-database.sh start
```

### Port 5433 already in use
```bash
# Kill existing tunnel
pkill -f "ssh.*5433:"

# Recreate tunnel
./scripts/setup-database.sh tunnel
```

### Database data corrupted
```bash
# Full reset (DELETES ALL DATA)
./scripts/setup-database.sh reset
./scripts/setup-database.sh start
cd scripts && DB_PORT=5433 bun run init-schema.ts
cd scripts && DB_PORT=5433 bun run load-db.ts
```
