Excellent! Thank you for the clarifications. Let me create a refined, focused prompt for your analytics platform:

---

# 📱 Smartphone Battery & Usage Analytics Platform - Master Prompt

## Role & Objective
You are an expert data analyst and full-stack developer specializing in behavioral analytics and data visualization. Your mission is to build a comprehensive analytics platform that transforms raw smartphone telemetry data into interactive, insightful visualizations exploring user charging behavior and device usage patterns.

## Project Context
You have access to multi-modal Android smartphone data collected from **approximately 300 users** over **7-14 days** each: 
- **Battery data**:  Charging cycles, battery level, temperature, health metrics
- **Foreground data**: App usage patterns, screen time, active applications
- **Network data**: WiFi/cellular connectivity, data transfer patterns
- **Sensor data**:  Accelerometer, gyroscope, location, and other sensor readings

**Data Format:** CSV files with common identifiers (user_id, device_id, timestamp)
**Data Distribution:** Multiple files, folders, and possibly archives

---

## Phase 1: Data Discovery, Quality Assessment & Consolidation

### Step 1: Comprehensive Data Inventory
```
TASK: Discover and catalog all available data

Actions:
1. List all files, directories, and archives
2. Identify CSV file structures and column schemas
3. Determine data volume (row counts per file)
4. Map date ranges per user/device
5. Identify common keys across data sources: 
   - user_id / device_id
   - timestamp / datetime columns
   - session identifiers

Output: Create an inventory document showing:
- File path | Data Type | Rows | Columns | Date Range | Key Fields
```

**Success Criteria:**
- Complete inventory of all data files documented
- Schema identified for each data type
- Common identifiers mapped across sources

### Step 2: Data Quality Assessment (Critical Requirement)
```
TASK: Perform comprehensive data quality analysis

This is a CORE requirement of your analysis. For each data source, assess: 

1. **Completeness Analysis**
   - Missing value percentage per column
   - Users/devices with incomplete data
   - Time gaps in data collection
   - Coverage:  How many users have data for all 4 sources?

2. **Consistency Checks**
   - Timestamp format consistency
   - Value range validation (e.g., battery 0-100%)
   - Duplicate record detection
   - Cross-source timestamp alignment

3. **Anomaly Detection**
   - Outliers in battery readings (impossible values)
   - Suspicious patterns (e.g., battery jumping from 10% to 90%)
   - Abnormal sensor readings
   - Data collection failures

4. **Temporal Coverage**
   - Actual collection period per user (is it 7-14 days?)
   - Sampling frequency per data type
   - Time zone consistency

Output Format:  Create a Data Quality Report including:
- Summary statistics table
- Heatmap of missing data by user and data type
- Outlier visualizations (box plots for key metrics)
- Recommendations for data cleaning
- Flagged issues requiring attention
```

**Visualization Requirements:**
- Missing data heatmap (users × columns)
- Box plots for numerical fields showing outliers
- Timeline coverage chart per user
- Distribution histograms for key metrics

**Success Criteria:**
- Every data quality issue documented with severity level
- Visual evidence provided for each issue type
- Clear recommendations for handling each issue
- Data retention/exclusion criteria defined

### Step 3: Data Consolidation & Integration
```
TASK: Design and implement data consolidation pipeline

Consolidation Strategy:
1. **Temporal Alignment**
   - Standardize all timestamps to UTC
   - Align data from different sources by timestamp windows
   - Handle different sampling rates appropriately

2. **Data Merging**
   - Create master table with device_id + timestamp as composite key
   - Left join other data sources to battery events (primary anchor)
   - Preserve granularity where needed

3. **Data Cleaning**
   - Handle missing values (document strategy per field)
   - Remove/flag duplicates
   - Correct obvious errors (if safe to do so)
   - Create data quality flags

4. **Feature Engineering for Analytics**
   - Derive time-based features (hour, day_of_week, is_weekend)
   - Calculate charging sessions (start, end, duration)
   - Compute usage metrics (screen time, app usage duration)
   - Network activity aggregations
```

**Required Consolidated Schema:**
```python
# Core identifier & temporal fields
user_id: str                      # Unique user identifier
device_id:  str                    # Unique device identifier  
timestamp: datetime64[ns, UTC]    # Standardized timestamp

# Battery metrics
battery_level: float              # 0-100%
battery_change: float             # Change from previous reading
is_charging: bool                 # Charging state
charge_type: str                  # USB/AC/Wireless/None
charging_session_id: str          # Unique ID per charging session
battery_temp: float               # Temperature in Celsius
battery_voltage: float            # Voltage in mV
battery_health: str               # Health status

# Charging session derived metrics
charge_session_start: datetime    # Session start time
charge_session_end: datetime      # Session end time  
charge_session_duration_min: float # Duration in minutes
charge_start_level: float         # Battery % at session start
charge_end_level: float           # Battery % at session end

# Usage metrics
foreground_app:  str               # Currently active app
app_category: str                 # App category (map apps to categories)
screen_state: bool                # Screen on/off
app_session_duration_sec: float   # How long app was active

# Network metrics
network_type:  str                 # WiFi/4G/5G/None
network_connected: bool           # Connection state
data_rx_bytes: int                # Received bytes
data_tx_bytes: int                # Transmitted bytes
data_total_mb: float              # Total data in MB

# Sensor metrics (aggregate or specific based on available data)
sensor_type: str                  # Accelerometer/Gyroscope/Location/etc.
sensor_value: float               # Sensor reading
location_lat: float               # GPS latitude (if available)
location_lon: float               # GPS longitude (if available)

# Derived temporal features
hour_of_day:  int                  # 0-23
day_of_week: int                  # 0=Monday to 6=Sunday
is_weekend: bool                  # Weekend flag
date:  date                        # Date only (for daily aggregations)

# Data quality flags
data_quality_flags: str           # JSON or comma-separated flags
```

**Output:**
- Consolidated CSV or Parquet file(s) ready for database import
- Consolidation report documenting: 
  - Records before/after cleaning
  - Merge statistics (match rates across sources)
  - Derived field calculations
  - Data transformations applied

---

## Phase 2: Exploratory Data Analysis (EDA) - Comprehensive

### Step 4: Descriptive Statistics & Distribution Analysis
```
TASK: Generate comprehensive statistical analysis

1. **Battery Behavior Analysis**
   
   Univariate Analysis:
   - Battery level distribution (histogram)
   - Charging session duration distribution (histogram + box plot)
   - Battery temperature distribution during charging vs. not charging
   - Time between charges (histogram)
   
   Temporal Patterns:
   - Charging frequency by hour of day (histogram)
   - Charging frequency by day of week (bar chart)
   - Charging start time heatmap (hour × day of week)
   - Average battery level time series (daily/hourly aggregates)
   
   Charging Session Analytics:
   - Average session duration by charge type
   - Battery level at charge start (histogram - when do users charge?)
   - Charge session completeness (do users fully charge?)
   - Charging speed analysis (% gained per minute by charge type)

2. **Usage Pattern Analysis**
   
   App Usage: 
   - Top 20 most-used apps (bar chart)
   - App usage by category (pie chart)
   - Screen time distribution per user (box plot)
   - App category usage by hour of day (stacked area chart)
   
   Battery Drain Analysis:
   - Battery drain rate by app category (box plot)
   - Battery consumption heatmap (app × hour of day)
   - Correlation:  usage intensity vs. battery drain
   
   Session Analysis:
   - App session duration distribution (histogram)
   - Number of app switches per day (histogram)
   - Longest continuous usage sessions

3. **Network Usage Analysis**
   
   Connectivity Patterns:
   - Network type distribution (pie chart)
   - Network switching frequency (histogram)
   - WiFi vs. cellular usage by time of day (stacked bar)
   
   Data Transfer:
   - Daily data consumption distribution (box plot)
   - Data usage by app category (bar chart)
   - Upload vs. download patterns (scatter plot)
   - Network activity correlation with battery drain

4. **Sensor Data Analysis**
   
   (Adapt based on available sensors)
   - Sensor reading distributions (histogram per sensor type)
   - Sensor activity correlation with battery/usage
   - Location patterns if GPS available (heatmap)
   - Movement patterns (if accelerometer available)

5. **Cross-Feature Correlation Analysis**
   - Correlation matrix (heatmap) between all numerical features
   - Key relationships to explore:
     * Battery drain rate vs. screen time
     * Battery drain vs.  network type
     * Temperature vs. charging type
     * Usage patterns vs. charging patterns
```

**Required Visualizations (Minimum):**

**Box Plots:**
- Battery level at charging start (per user and aggregate)
- Charging session duration (per user and aggregate)
- Daily screen time distribution
- Battery drain rate by app category
- Daily data consumption

**Histograms:**
- Battery level distribution
- Time between charges
- Charging session duration
- App session duration
- Hourly charging frequency

**Heatmaps:**
- Charging start time (hour × day of week)
- Missing data by user/column
- Correlation matrix of numerical features
- Battery consumption by app × hour
- Network type usage (hour × day)

**Time Series:**
- Average battery level over time (across all users)
- Individual user battery level trajectories (sample 10-20 users)
- Charging events timeline (annotated time series)
- Daily aggregates with confidence intervals
- Network data usage over time

**Network Graphs:**
- App transition network (which apps users switch between)
  * Nodes = apps
  * Edges = transitions between apps
  * Edge weight = transition frequency
- Network type transition graph (WiFi ↔ 4G ↔ 5G)
- User similarity network (based on behavior clustering)
  * Nodes = users
  * Edges = behavioral similarity
  * Layout = force-directed or community detection

**Additional Visualizations:**
- Pie/Donut charts for categorical distributions
- Stacked area charts for temporal category breakdowns
- Violin plots for comparing distributions
- Scatter plots for correlation exploration

### Step 5: User Segmentation & Aggregate Analysis
```
TASK: Perform both user-level and aggregate-level analysis

Aggregate-Level Insights:
- Overall charging behavior patterns (across all 300 users)
- Population-level statistics and distributions
- Common usage patterns and trends
- Typical vs. atypical behavior boundaries

User-Level Drill-Down:
For each user, calculate and document:
- Personal charging profile: 
  * Average charging frequency (per day)
  * Preferred charging times
  * Average session duration
  * Battery level at charge start (typical behavior)
  
- Usage profile:
  * Daily screen time average
  * Top 5 apps by usage time
  * Most active hours
  * Dominant app categories
  
- Network profile:
  * Primary network type
  * Daily data consumption
  * WiFi vs. cellular ratio
  
- Comparative metrics:
  * How does this user compare to population average?
  * Percentile rankings for key metrics
  * Deviation from typical patterns

User Clustering (Descriptive, not ML):
- Define behavioral archetypes based on EDA: 
  * "Heavy users" - top 10% screen time
  * "Frequent chargers" - charge >2x per day
  * "Night owls" - peak usage after 10 PM
  * "Data intensive" - top 10% network usage
  * etc.
  
- Assign users to segments based on thresholds
- Create segment comparison tables and charts
```

**Output Format:** 
- Jupyter notebook with narrative markdown explaining each finding
- All visualizations embedded with clear titles and axis labels
- Summary tables for key statistics
- Insight callouts highlighting interesting patterns

---

## Phase 3: Database Architecture & Backend API

### Step 6: TimescaleDB Schema Design
```
TASK: Design and implement time-series optimized database

Recommended:  TimescaleDB (PostgreSQL with time-series extensions)
Rationale: Better for historical analysis, SQL-friendly, excellent aggregation performance

Schema Design: 

1. **Raw Event Tables** (Hypertables)

-- Battery events (highest granularity)
CREATE TABLE battery_events (
  event_id BIGSERIAL,
  user_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  battery_level REAL CHECK (battery_level >= 0 AND battery_level <= 100),
  battery_change REAL,
  is_charging BOOLEAN,
  charge_type VARCHAR(20),
  battery_temp REAL,
  battery_voltage REAL,
  battery_health VARCHAR(50),
  data_quality_flags TEXT,
  PRIMARY KEY (device_id, timestamp)
);

SELECT create_hypertable('battery_events', 'timestamp');
CREATE INDEX idx_battery_user ON battery_events(user_id, timestamp DESC);
CREATE INDEX idx_battery_device ON battery_events(device_id, timestamp DESC);

-- Charging sessions (derived, session-level)
CREATE TABLE charging_sessions (
  session_id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  duration_minutes REAL,
  start_battery_level REAL,
  end_battery_level REAL,
  charge_gained REAL,
  charge_type VARCHAR(20),
  avg_temp REAL,
  is_complete BOOLEAN
);

SELECT create_hypertable('charging_sessions', 'session_start');

-- App usage events
CREATE TABLE app_usage_events (
  event_id BIGSERIAL,
  user_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  foreground_app VARCHAR(200),
  app_category VARCHAR(100),
  session_duration_sec REAL,
  screen_state BOOLEAN,
  PRIMARY KEY (device_id, timestamp, foreground_app)
);

SELECT create_hypertable('app_usage_events', 'timestamp');

-- Network events
CREATE TABLE network_events (
  event_id BIGSERIAL,
  user_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  network_type VARCHAR(20),
  network_connected BOOLEAN,
  data_rx_bytes BIGINT,
  data_tx_bytes BIGINT,
  PRIMARY KEY (device_id, timestamp)
);

SELECT create_hypertable('network_events', 'timestamp');

-- Sensor events (flexible schema for different sensor types)
CREATE TABLE sensor_events (
  event_id BIGSERIAL,
  user_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  sensor_value JSONB, -- Flexible for different sensor data structures
  PRIMARY KEY (device_id, timestamp, sensor_type)
);

SELECT create_hypertable('sensor_events', 'timestamp');

2. **Aggregated Tables** (Continuous Aggregates for Performance)

-- Hourly battery aggregates
CREATE MATERIALIZED VIEW battery_hourly_agg
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  time_bucket('1 hour', timestamp) AS hour,
  AVG(battery_level) AS avg_battery_level,
  MIN(battery_level) AS min_battery_level,
  MAX(battery_level) AS max_battery_level,
  COUNT(*) AS reading_count,
  COUNT(*) FILTER (WHERE is_charging) AS charging_count,
  AVG(battery_temp) AS avg_temp
FROM battery_events
GROUP BY device_id, hour;

-- Daily summary per device
CREATE MATERIALIZED VIEW device_daily_summary
WITH (timescaledb. continuous) AS
SELECT
  device_id,
  time_bucket('1 day', timestamp) AS day,
  AVG(battery_level) AS avg_battery,
  COUNT(*) FILTER (WHERE is_charging) AS charge_events,
  MAX(battery_temp) AS max_temp,
  COUNT(*) AS data_points
FROM battery_events
GROUP BY device_id, day;

-- User behavior profiles (static table, computed from EDA)
CREATE TABLE user_profiles (
  user_id VARCHAR(100) PRIMARY KEY,
  device_id VARCHAR(100),
  data_start_date DATE,
  data_end_date DATE,
  total_days INT,
  avg_daily_charge_count REAL,
  avg_charge_duration_min REAL,
  avg_charge_start_level REAL,
  avg_daily_screen_time_min REAL,
  avg_daily_data_mb REAL,
  top_apps JSONB,
  dominant_categories JSONB,
  preferred_charge_hours INT[], -- Array of hours (e.g., {6, 22})
  behavioral_segment VARCHAR(50),
  percentile_rankings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate statistics (global level)
CREATE TABLE aggregate_statistics (
  stat_id SERIAL PRIMARY KEY,
  stat_name VARCHAR(200) UNIQUE NOT NULL,
  stat_value JSONB,
  stat_category VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Examples of records in aggregate_statistics: 
-- ('overall_avg_charge_freq', '{"value": 1.8, "unit": "per_day"}', 'charging')
-- ('top_battery_draining_apps', '[{"app": "YouTube", "drain_rate": 15. 2}, ...]', 'usage')
```

**Data Loading:**
```python
# Script to load consolidated CSV into TimescaleDB
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://user:pass@localhost: 5432/battery_analytics')

# Load consolidated data
battery_df = pd.read_csv('consolidated_battery_events.csv')
charging_df = pd.read_csv('consolidated_charging_sessions.csv')
app_df = pd.read_csv('consolidated_app_usage. csv')
network_df = pd.read_csv('consolidated_network_events.csv')

# Insert into database
battery_df.to_sql('battery_events', engine, if_exists='append', index=False, method='multi', chunksize=10000)
charging_df.to_sql('charging_sessions', engine, if_exists='append', index=False, method='multi', chunksize=5000)
app_df.to_sql('app_usage_events', engine, if_exists='append', index=False, method='multi', chunksize=10000)
network_df.to_sql('network_events', engine, if_exists='append', index=False, method='multi', chunksize=10000)

print("Data loaded successfully")
```

### Step 7: Bun + Elysia Backend API
```
TASK: Implement RESTful API for analytics queries

Project Structure:
/server
  /src
    /db
      connection.ts        # Database connection pool
      queries.ts           # SQL query functions
    /routes
      analytics.ts         # Analytics endpoints
      users.ts             # User-level endpoints
      aggregates.ts        # Aggregate statistics endpoints
    /services
      analyticsService.ts  # Business logic layer
      cacheService.ts      # Caching logic (if needed)
    /types
      index.ts             # TypeScript type definitions
    index.ts               # Main server file
  package.json
  tsconfig.json
```

**Main Server Setup:**
```typescript
// server/src/index.ts
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import analyticsRoutes from './routes/analytics'
import userRoutes from './routes/users'
import aggregateRoutes from './routes/aggregates'

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Battery Analytics API',
        version: '1.0.0',
        description: 'API for smartphone battery and usage analytics'
      }
    }
  }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(analyticsRoutes)
  .use(userRoutes)
  .use(aggregateRoutes)
  .listen(3001)

console.log(`🚀 Server running at http://${app.server?. hostname}:${app.server?.port}`)
```

**Database Connection:**
```typescript
// server/src/db/connection.ts
import { Pool } from 'pg'

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'battery_analytics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis:  2000,
})

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('Executed query', { text, duration, rows: res.rowCount })
  return res
}
```

**Core API Endpoints:**
```typescript
// server/src/routes/analytics. ts
import { Elysia, t } from 'elysia'
import * as analyticsService from '../services/analyticsService'

export default new Elysia({ prefix: '/api/analytics' })
  
  // Battery time series data
  .get('/battery-timeseries', async ({ query }) => {
    const { device_id, start_date, end_date, granularity = 'hour' } = query
    return await analyticsService.getBatteryTimeSeries(
      device_id,
      start_date,
      end_date,
      granularity as 'raw' | 'hour' | 'day'
    )
  }, {
    query: t.Object({
      device_id: t.String(),
      start_date: t.String({ format: 'date' }),
      end_date: t.String({ format: 'date' }),
      granularity:  t.Optional(t.Union([
        t. Literal('raw'),
        t.Literal('hour'),
        t.Literal('day')
      ]))
    })
  })
  
  // Charging sessions for a device
  .get('/charging-sessions', async ({ query }) => {
    const { device_id, start_date, end_date } = query
    return await analyticsService.getChargingSessions(device_id, start_date, end_date)
  }, {
    query: t.Object({
      device_id: t.String(),
      start_date: t.Optional(t.String({ format: 'date' })),
      end_date: t.Optional(t.String({ format: 'date' }))
    })
  })
  
  // Charging behavior statistics
  .get('/charging-behavior', async ({ query }) => {
    const { device_id } = query
    return await analyticsService.getChargingBehaviorStats(device_id)
  }, {
    query: t. Object({
      device_id:  t.String()
    })
  })
  
  // App usage breakdown
  .get('/app-usage', async ({ query }) => {
    const { device_id, start_date, end_date, group_by = 'app' } = query
    return await analyticsService.getAppUsage(
      device_id,
      start_date,
      end_date,
      group_by as 'app' | 'category'
    )
  }, {
    query: t.Object({
      device_id: t. String(),
      start_date: t.Optional(t.String({ format: 'date' })),
      end_date: t. Optional(t.String({ format: 'date' })),
      group_by: t.Optional(t.Union([t.Literal('app'), t.Literal('category')]))
    })
  })
  
  // Network usage patterns
  .get('/network-usage', async ({ query }) => {
    const { device_id, start_date, end_date } = query
    return await analyticsService.getNetworkUsage(device_id, start_date, end_date)
  }, {
    query: t.Object({
      device_id: t.String(),
      start_date: t.Optional(t.String({ format: 'date' })),
      end_date: t.Optional(t.String({ format: 'date' }))
    })
  })
  
  // Battery consumption heatmap data
  .get('/battery-consumption-heatmap', async ({ query }) => {
    const { device_id, metric = 'drain_rate' } = query
    return await analyticsService.getBatteryHeatmap(device_id, metric as string)
  }, {
    query: t.Object({
      device_id: t.String(),
      metric: t.Optional(t.String())
    })
  })
  
  // Correlation analysis
  .get('/correlations', async ({ query }) => {
    const { device_id } = query
    return await analyticsService.getCorrelationMatrix(device_id)
  }, {
    query: t.Object({
      device_id: t.Optional(t.String()) // Optional - if null, return aggregate
    })
  })

// server/src/routes/users.ts
import { Elysia, t } from 'elysia'
import * as userService from '../services/userService'

export default new Elysia({ prefix: '/api/users' })
  
  // List all users
  .get('/', async () => {
    return await userService.getAllUsers()
  })
  
  // Get user profile
  .get('/:user_id', async ({ params }) => {
    return await userService.getUserProfile(params.user_id)
  }, {
    params: t.Object({
      user_id: t.String()
    })
  })
  
  // Get user's devices
  .get('/:user_id/devices', async ({ params }) => {
    return await userService.getUserDevices(params.user_id)
  }, {
    params: t. Object({
      user_id:  t.String()
    })
  })
  
  // Compare user to population
  .get('/:user_id/comparison', async ({ params }) => {
    return await userService.getUserComparison(params.user_id)
  }, {
    params: t.Object({
      user_id: t.String()
    })
  })

// server/src/routes/aggregates.ts
import { Elysia } from 'elysia'
import * as aggregateService from '../services/aggregateService'

export default new Elysia({ prefix: '/api/aggregates' })
  
  // Overall statistics
  .get('/statistics', async () => {
    return await aggregateService.getOverallStatistics()
  })
  
  // Charging patterns (aggregate)
  .get('/charging-patterns', async () => {
    return await aggregateService.getAggregateChargingPatterns()
  })
  
  // App usage leaderboard
  .get('/top-apps', async ({ query }) => {
    const { metric = 'usage_time', limit = 20 } = query
    return await aggregateService.getTopApps(metric as string, parseInt(limit as string))
  })
  
  // User segments
  .get('/segments', async () => {
    return await aggregateService.getUserSegments()
  })
  
  // Network transition graph data
  .get('/network-transitions', async () => {
    return await aggregateService.getNetworkTransitions()
  })
  
  // App transition graph data
  .get('/app-transitions', async ({ query }) => {
    const { device_id, min_weight = 5 } = query
    return await aggregateService.getAppTransitions(
      device_id as string | undefined,
      parseInt(min_weight as string)
    )
  })
```

**Example Service Implementation:**
```typescript
// server/src/services/analyticsService. ts
import { query } from '../db/connection'

export async function getBatteryTimeSeries(
  deviceId: string,
  startDate: string,
  endDate: string,
  granularity: 'raw' | 'hour' | 'day'
) {
  if (granularity === 'raw') {
    const result = await query(
      `SELECT timestamp, battery_level, is_charging, battery_temp, charge_type
       FROM battery_events
       WHERE device_id = $1 AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp ASC`,
      [deviceId, startDate, endDate]
    )
    return result.rows
  } else if (granularity === 'hour') {
    const result = await query(
      `SELECT hour AS timestamp, avg_battery_level, min_battery_level, max_battery_level, charging_count
       FROM battery_hourly_agg
       WHERE device_id = $1 AND hour BETWEEN $2 AND $3
       ORDER BY hour ASC`,
      [deviceId, startDate, endDate]
    )
    return result.rows
  } else {
    const result = await query(
      `SELECT day AS timestamp, avg_battery, charge_events, max_temp, data_points
       FROM device_daily_summary
       WHERE device_id = $1 AND day BETWEEN $2 AND $3
       ORDER BY day ASC`,
      [deviceId, startDate, endDate]
    )
    return result.rows
  }
}

export async function getChargingBehaviorStats(deviceId: string) {
  const result = await query(
    `SELECT 
      COUNT(*) AS total_sessions,
      AVG(duration_minutes) AS avg_duration,
      AVG(start_battery_level) AS avg_start_level,
      AVG(charge_gained) AS avg_charge_gained,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM session_start)) AS preferred_hour,
      COUNT(*) FILTER (WHERE is_complete) AS complete_sessions,
      jsonb_object_agg(charge_type, count) AS sessions_by_type
    FROM (
      SELECT *, COUNT(*) OVER (PARTITION BY charge_type) AS count
      FROM charging_sessions
      WHERE device_id = $1
    ) subq
    GROUP BY device_id`,
    [deviceId]
  )
  return result.rows[0]
}

export async function getAppUsage(
  deviceId: string,
  startDate?:  string,
  endDate?: string,
  groupBy:  'app' | 'category' = 'app'
) {
  const groupField = groupBy === 'app' ? 'foreground_app' : 'app_category'
  
  let sql = `
    SELECT 
      ${groupField} AS name,
      SUM(session_duration_sec) / 60.0 AS total_minutes,
      COUNT(*) AS session_count,
      AVG(session_duration_sec) AS avg_session_sec
    FROM app_usage_events
    WHERE device_id = $1
  `
  
  const params = [deviceId]
  
  if (startDate && endDate) {
    sql += ` AND timestamp BETWEEN $2 AND $3`
    params.push(startDate, endDate)
  }
  
  sql += ` GROUP BY ${groupField} ORDER BY total_minutes DESC LIMIT 50`
  
  const result = await query(sql, params)
  return result.rows
}

// Add more service functions for other endpoints...
```

---

## Phase 4: React Frontend with shadcn/ui

### Step 8: Frontend Architecture
```
TASK: Build responsive analytics dashboard

Project Structure:
/client
  /src
    /components
      /ui                    # shadcn components (button, card, etc.)
      /charts
        BatteryTimeSeriesChart.tsx
        ChargingHeatmap.tsx
        UsageDistribution.tsx
        CorrelationMatrix.tsx
        NetworkGraph.tsx
        BoxPlotChart.tsx
      /dashboard
        DashboardLayout.tsx
        OverviewDashboard.tsx
        DeviceDetailView.tsx
        UserComparisonView.tsx
        AggregateInsights.tsx
      /filters
        DateRangePicker.tsx
        DeviceSelector.tsx
        GranularitySelector.tsx
    /lib
      /api
        client.ts           # API client with fetch wrapper
        endpoints.ts        # Endpoint definitions
      /utils
        formatters.ts       # Data formatting utilities
        chartHelpers.ts     # Chart data transformation
      utils.ts              # shadcn utils (cn function)
    /hooks
      useAnalyticsData.ts
      useDeviceList.ts
      useAggregateStats.ts
    /types
      index.ts              # TypeScript interfaces
    App.tsx
    main.tsx
  package.json
  tsconfig. json
  tailwind.config.ts
  components.json          # shadcn config
```

**Setup Instructions:**
```bash
# Initialize Bun + React project
bun create vite client --template react-ts
cd client
bun install

# Install shadcn/ui
bunx shadcn-ui@latest init

# Install chart libraries
bun add recharts
bun add @tanstack/react-query
bun add date-fns
bun add react-router-dom

# Install shadcn components
bunx shadcn-ui@latest add card
bunx shadcn-ui@latest add button
bunx shadcn-ui@latest add select
bunx shadcn-ui@latest add tabs
bunx shadcn-ui@latest add table
bunx shadcn-ui@latest add badge
bunx shadcn-ui@latest add skeleton
bunx shadcn-ui@latest add alert
bunx shadcn-ui@latest add dialog
```

### Step 9: Core Dashboard Components

**API Client:**
```typescript
// client/src/lib/api/client. ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}

// client/src/lib/api/endpoints.ts
export const analyticsAPI = {
  getBatteryTimeSeries: (deviceId: string, startDate: string, endDate: string, granularity: string) =>
    fetchAPI(`/analytics/battery-timeseries? device_id=${deviceId}&start_date=${startDate}&end_date=${endDate}&granularity=${granularity}`),
  
  getChargingSessions: (deviceId: string, startDate?:  string, endDate?: string) =>
    fetchAPI(`/analytics/charging-sessions?device_id=${deviceId}${startDate ? `&start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`),
  
  getChargingBehavior: (deviceId: string) =>
    fetchAPI(`/analytics/charging-behavior?device_id=${deviceId}`),
  
  getAppUsage: (deviceId: string, groupBy: string = 'category') =>
    fetchAPI(`/analytics/app-usage?device_id=${deviceId}&group_by=${groupBy}`),
  
  getNetworkUsage: (deviceId: string) =>
    fetchAPI(`/analytics/network-usage?device_id=${deviceId}`),
}

export const userAPI = {
  getAllUsers: () => fetchAPI('/users'),
  getUserProfile: (userId: string) => fetchAPI(`/users/${userId}`),
  getUserComparison: (userId: string) => fetchAPI(`/users/${userId}/comparison`),
}

export const aggregateAPI = {
  getOverallStats: () => fetchAPI('/aggregates/statistics'),
  getChargingPatterns: () => fetchAPI('/aggregates/charging-patterns'),
  getTopApps: (metric: string = 'usage_time', limit:  number = 20) =>
    fetchAPI(`/aggregates/top-apps?metric=${metric}&limit=${limit}`),
  getAppTransitions: (deviceId?:  string) =>
    fetchAPI(`/aggregates/app-transitions${deviceId ? `?device_id=${deviceId}` : ''}`),
}
```

**Main Dashboard Layout:**
```typescript
// client/src/components/dashboard/DashboardLayout. tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import OverviewDashboard from './OverviewDashboard'
import DeviceDetailView from './DeviceDetailView'
import AggregateInsights from './AggregateInsights'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold">📱 Battery Analytics Platform</h1>
          <p className="text-muted-foreground">Smartphone Usage & Charging Behavior Analysis</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="device">Device Detail</TabsTrigger>
            <TabsTrigger value="aggregate">Aggregate Insights</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <OverviewDashboard />
          </TabsContent>
          
          <TabsContent value="device" className="space-y-4">
            <DeviceDetailView />
          </TabsContent>
          
          <TabsContent value="aggregate" className="space-y-4">
            <AggregateInsights />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
```

**Battery Time Series Chart:**
```typescript
// client/src/components/charts/BatteryTimeSeriesChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, Brush } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format, parseISO } from 'date-fns'

interface BatteryTimeSeriesChartProps {
  data: Array<{
    timestamp: string
    battery_level: number
    is_charging: boolean
    charge_type?:  string
  }>
  chargingSessions?:  Array<{
    session_start: string
    session_end:  string
  }>
}

export function BatteryTimeSeriesChart({ data, chargingSessions }:  BatteryTimeSeriesChartProps) {
  const formattedData = data.map(d => ({
    ... d,
    time: format(parseISO(d.timestamp), 'MMM dd HH:mm'),
    fullTimestamp: d.timestamp,
  }))
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Battery Level Over Time</CardTitle>
        <CardDescription>Time series view with charging events highlighted</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 100]} 
              label={{ value: 'Battery Level (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              labelFormatter={(value) => value}
              formatter={(value:  number, name: string) => {
                if (name === 'battery_level') return [`${value. toFixed(1)}%`, 'Battery']
                return [value, name]
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="battery_level" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              name="Battery Level"
            />
            
            {/* Render charging sessions as reference areas */}
            {chargingSessions?.map((session, idx) => (
              <ReferenceLine
                key={idx}
                x={format(parseISO(session.session_start), 'MMM dd HH:mm')}
                stroke="green"
                strokeDasharray="3 3"
                label={{ value: '⚡', position: 'top' }}
              />
            ))}
            
            <Brush dataKey="time" height={30} stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

**Charging Heatmap:**
```typescript
// client/src/components/charts/ChargingHeatmap.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMemo } from 'react'

interface ChargingHeatmapProps {
  data: Array<{
    hour: number
    day_of_week: number
    charge_count: number
  }>
}

export function ChargingHeatmap({ data }: ChargingHeatmapProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  // Create matrix
  const matrix = useMemo(() => {
    const m:  number[][] = Array(7).fill(0).map(() => Array(24).fill(0))
    data.forEach(d => {
      m[d.day_of_week][d.hour] = d.charge_count
    })
    return m
  }, [data])
  
  const maxCount = Math.max(...data.map(d => d.charge_count))
  
  const getColor = (count: number) => {
    const intensity = count / maxCount
    return `rgba(34, 197, 94, ${intensity})` // Green with varying opacity
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Charging Patterns Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-sm font-medium"></th>
                {hours.map(h => (
                  <th key={h} className="p-2 text-sm font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, dayIdx) => (
                <tr key={day}>
                  <td className="p-2 text-sm font-medium">{day}</td>
                  {hours.map(hour => {
                    const count = matrix[dayIdx][hour]
                    return (
                      <td
                        key={hour}
                        className="border border-gray-200 w-8 h-8 text-xs text-center"
                        style={{ backgroundColor: getColor(count) }}
                        title={`${day} ${hour}:00 - ${count} charges`}
                      >
                        {count > 0 ?  count : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span>Low</span>
          <div className="flex gap-1">
            {[0. 2, 0.4, 0.6, 0.8, 1.0]. map(intensity => (
              <div
                key={intensity}
                className="w-8 h-4 border border-gray-300"
                style={{ backgroundColor: `rgba(34, 197, 94, ${intensity})` }}
              />
            ))}
          </div>
          <span>High</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Box Plot Component:**
```typescript
// client/src/components/charts/BoxPlotChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMemo } from 'react'

interface BoxPlotData {
  category: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers?:  number[]
}

interface BoxPlotChartProps {
  data:  BoxPlotData[]
  yLabel: string
  title: string
}

export function BoxPlotChart({ data, yLabel, title }: BoxPlotChartProps) {
  const maxValue = Math.max(...data.map(d => d.max))
  const minValue = Math.min(...data.map(d => d.min))
  const range = maxValue - minValue
  
  const scaleY = (value: number) => {
    return ((value - minValue) / range) * 300 // 300px height
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <svg width="100%" height="400" viewBox="0 0 800 400">
          {/* Y-axis */}
          <line x1="50" y1="50" x2="50" y2="350" stroke="black" />
          <line x1="50" y1="350" x2="750" y2="350" stroke="black" />
          
          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(factor => {
            const value = minValue + range * factor
            const y = 350 - scaleY(value)
            return (
              <g key={factor}>
                <line x1="45" y1={y} x2="50" y2={y} stroke="black" />
                <text x="40" y={y + 4} textAnchor="end" fontSize="12">
                  {value. toFixed(0)}
                </text>
              </g>
            )
          })}
          
          {/* Box plots */}
          {data. map((item, idx) => {
            const x = 100 + idx * (650 / data.length)
            const boxWidth = 40
            
            const yMax = 350 - scaleY(item.max)
            const yQ3 = 350 - scaleY(item.q3)
            const yMedian = 350 - scaleY(item.median)
            const yQ1 = 350 - scaleY(item.q1)
            const yMin = 350 - scaleY(item. min)
            
            return (
              <g key={item.category}>
                {/* Whiskers */}
                <line x1={x} y1={yMin} x2={x} y2={yQ1} stroke="black" />
                <line x1={x} y1={yQ3} x2={x} y2={yMax} stroke="black" />
                <line x1={x - 10} y1={yMin} x2={x + 10} y2={yMin} stroke="black" />
                <line x1={x - 10} y1={yMax} x2={x + 10} y2={yMax} stroke="black" />
                
                {/* Box */}
                <rect
                  x={x - boxWidth / 2}
                  y={yQ3}
                  width={boxWidth}
                  height={yQ1 - yQ3}
                  fill="lightblue"
                  stroke="black"
                />
                
                {/* Median line */}
                <line
                  x1={x - boxWidth / 2}
                  y1={yMedian}
                  x2={x + boxWidth / 2}
                  y2={yMedian}
                  stroke="red"
                  strokeWidth="2"
                />
                
                {/* Outliers */}
                {item.outliers?. map((outlier, oIdx) => {
                  const yOutlier = 350 - scaleY(outlier)
                  return (
                    <circle
                      key={oIdx}
                      cx={x}
                      cy={yOutlier}
                      r="3"
                      fill="red"
                    />
                  )
                })}
                
                {/* Label */}
                <text
                  x={x}
                  y="370"
                  textAnchor="middle"
                  fontSize="12"
                >
                  {item.category}
                </text>
              </g>
            )
          })}
          
          {/* Y-axis label */}
          <text
            x="20"
            y="200"
            textAnchor="middle"
            fontSize="14"
            transform="rotate(-90, 20, 200)"
          >
            {yLabel}
          </text>
        </svg>
      </CardContent>
    </Card>
  )
}
```

**Network Graph Component:**
```typescript
// client/src/components/charts/NetworkGraph.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useRef } from 'react'

interface Node {
  id: string
  label: string
  size: number
}

interface Edge {
  source: string
  target: string
  weight: number
}

interface NetworkGraphProps {
  nodes: Node[]
  edges: Edge[]
  title:  string
}

export function NetworkGraph({ nodes, edges, title }:  NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef. current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Simple force-directed layout simulation
    const width = canvas.width
    const height = canvas.height
    
    // Initialize node positions randomly
    const nodePositions = new Map(
      nodes.map(node => [
        node.id,
        {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0,
          vy: 0,
        },
      ])
    )
    
    // Force simulation (simplified)
    const simulate = () => {
      // Apply forces
      for (let i = 0; i < 50; i++) {
        // Repulsion between nodes
        nodes.forEach(nodeA => {
          const posA = nodePositions.get(nodeA.id)!
          nodes.forEach(nodeB => {
            if (nodeA.id === nodeB.id) return
            const posB = nodePositions.get(nodeB.id)!
            const dx = posB.x - posA.x
            const dy = posB.y - posA.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = -100 / (dist * dist)
            posA.vx += (dx / dist) * force
            posA.vy += (dy / dist) * force
          })
        })
        
        // Attraction along edges
        edges.forEach(edge => {
          const posSource = nodePositions.get(edge.source)!
          const posTarget = nodePositions.get(edge.target)!
          const dx = posTarget.x - posSource.x
          const dy = posTarget.y - posSource. y
          const dist = Math. sqrt(dx * dx + dy * dy) || 1
          const force = dist * 0.01
          posSource.vx += (dx / dist) * force
          posSource.vy += (dy / dist) * force
          posTarget.vx -= (dx / dist) * force
          posTarget.vy -= (dy / dist) * force
        })
        
        // Update positions
        nodePositions.forEach(pos => {
          pos.x += pos.vx
          pos. y += pos.vy
          pos.vx *= 0.8 // Damping
          pos.vy *= 0.8
          
          // Keep in bounds
          pos.x = Math.max(50, Math.min(width - 50, pos.x))
          pos.y = Math.max(50, Math.min(height - 50, pos.y))
        })
      }
      
      // Render
      ctx.clearRect(0, 0, width, height)
      
      // Draw edges
      edges.forEach(edge => {
        const posSource = nodePositions.get(edge.source)!
        const posTarget = nodePositions.get(edge.target)!
        ctx.beginPath()
        ctx.moveTo(posSource.x, posSource.y)
        ctx.lineTo(posTarget.x, posTarget.y)
        ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(edge.weight / 20, 1)})`
        ctx.lineWidth = Math.sqrt(edge.weight) / 2
        ctx.stroke()
      })
      
      // Draw nodes
      nodes.forEach(node => {
        const pos = nodePositions.get(node.id)!
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, Math.sqrt(node.size) * 2, 0, Math.PI * 2)
        ctx.fillStyle = '#3b82f6'
        ctx.fill()
        ctx.strokeStyle = '#1e40af'
        ctx.stroke()
        
        // Label
        ctx.fillStyle = 'black'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(node.label, pos. x, pos.y - Math.sqrt(node.size) * 2 - 5)
      })
    }
    
    simulate()
  }, [nodes, edges])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} width={800} height={600} className="border" />
      </CardContent>
    </Card>
  )
}
```

**Overview Dashboard:**
```typescript
// client/src/components/dashboard/OverviewDashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { aggregateAPI } from '@/lib/api/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChargingHeatmap } from '../charts/ChargingHeatmap'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function OverviewDashboard() {
  const { data: stats, isLoading:  statsLoading, error:  statsError } = useQuery({
    queryKey: ['overallStats'],
    queryFn:  () => aggregateAPI.getOverallStats(),
  })
  
  const { data: chargingPatterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['chargingPatterns'],
    queryFn: () => aggregateAPI.getChargingPatterns(),
  })
  
  const { data: topApps, isLoading: appsLoading } = useQuery({
    queryKey: ['topApps'],
    queryFn: () => aggregateAPI.getTopApps('usage_time', 15),
  })
  
  if (statsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load overview data. Please try again.
        </AlertDescription>
      </Alert>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{stats?. total_users || 0}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg.  Charges/Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">
                {stats?.avg_charge_frequency?. toFixed(1) || '—'}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Session Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">
                {stats?.avg_session_duration_min?. toFixed(0) || '—'} <span className="text-lg">min</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Battery at Charge
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">
                {stats?.avg_battery_at_charge?.toFixed(0) || '—'}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Charging Patterns Heatmap */}
      {patternsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : chargingPatterns ?  (
        <ChargingHeatmap data={chargingPatterns} />
      ) : null}
      
      {/* Top Apps by Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Top Apps by Usage Time</CardTitle>
        </CardHeader>
        <CardContent>
          {appsLoading ?  (
            <Skeleton className="h-96 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topApps} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" label={{ value: 'Total Hours', position: 'bottom' }} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip />
                <Bar dataKey="total_minutes" fill="#3b82f6" name="Usage (minutes)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Device Detail View:**
```typescript
// client/src/components/dashboard/DeviceDetailView.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { userAPI, analyticsAPI } from '@/lib/api/endpoints'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BatteryTimeSeriesChart } from '../charts/BatteryTimeSeriesChart'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DeviceDetailView() {
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  
  const { data:  users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAllUsers(),
  })
  
  const { data: batteryData, isLoading: batteryLoading } = useQuery({
    queryKey: ['batteryTimeSeries', selectedDevice],
    queryFn
