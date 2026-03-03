/**
 * Service layer for battery charging data queries.
 * All queries target the battery_charging_events database.
 */
import { queryCharging } from '../db/charging-connection';

// ─── Overall Stats ──────────────────────────────────────────────────────────

export async function getOverallStats() {
  const result = await queryCharging(`
    SELECT
      (SELECT COUNT(*) FROM user_stats) as total_users,
      (SELECT COUNT(*) FROM charging_events) as total_events,
      (SELECT COUNT(*) FROM charging_sessions) as total_sessions,
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE) as complete_sessions,
      (SELECT COUNT(*) FROM user_stats WHERE is_anomalous = TRUE) as anomalous_users,
      (SELECT AVG(duration_minutes) FROM charging_sessions WHERE is_complete = TRUE) as avg_duration_minutes,
      (SELECT AVG(charge_gained) FROM charging_sessions WHERE is_complete = TRUE AND charge_gained >= 0) as avg_charge_gained,
      (SELECT AVG(start_percentage) FROM charging_sessions) as avg_connect_level,
      (SELECT AVG(end_percentage) FROM charging_sessions WHERE is_complete = TRUE) as avg_disconnect_level,
      (SELECT MIN(event_timestamp) FROM charging_events) as data_start,
      (SELECT MAX(event_timestamp) FROM charging_events) as data_end
  `);
  return result.rows[0];
}

// ─── User List ──────────────────────────────────────────────────────────────

export async function getUsers(sortBy = 'user_id', order = 'asc', limit = 300) {
  const validSorts: Record<string, string> = {
    user_id: 'user_id',
    total_events: 'total_events',
    total_sessions: 'total_sessions',
    avg_duration: 'avg_duration_minutes',
    avg_charge: 'avg_charge_gained',
    mismatch: 'event_mismatch',
  };
  const sortCol = validSorts[sortBy] || 'user_id';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  const result = await queryCharging(`
    SELECT 
      user_id, total_events, connect_count, disconnect_count,
      event_mismatch, total_sessions, complete_sessions,
      ROUND(avg_duration_minutes::numeric, 1) as avg_duration_minutes,
      ROUND(avg_charge_gained::numeric, 1) as avg_charge_gained,
      ROUND(avg_connect_percentage::numeric, 1) as avg_connect_percentage,
      ROUND(avg_disconnect_percentage::numeric, 1) as avg_disconnect_percentage,
      first_event, last_event, is_anomalous
    FROM user_stats
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT $1
  `, [limit]);
  return result.rows;
}

// ─── Single User Detail ─────────────────────────────────────────────────────

export async function getUserDetail(userId: number) {
  const statsResult = await queryCharging(
    'SELECT * FROM user_stats WHERE user_id = $1',
    [userId]
  );

  const sessionsResult = await queryCharging(`
    SELECT id, connect_time, disconnect_time, 
      ROUND(duration_minutes::numeric, 1) as duration_minutes,
      start_percentage, end_percentage, charge_gained, is_complete
    FROM charging_sessions 
    WHERE user_id = $1 
    ORDER BY connect_time ASC
  `, [userId]);

  return {
    stats: statsResult.rows[0] || null,
    sessions: sessionsResult.rows,
  };
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function getSessions(userId?: number, completeOnly = false, limit = 500) {
  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (userId) {
    where += ` AND user_id = $${paramIdx++}`;
    params.push(userId);
  }
  if (completeOnly) {
    where += ' AND is_complete = TRUE';
  }

  params.push(limit);

  const result = await queryCharging(`
    SELECT id, user_id, connect_time, disconnect_time,
      ROUND(duration_minutes::numeric, 1) as duration_minutes,
      start_percentage, end_percentage, charge_gained, is_complete
    FROM charging_sessions
    ${where}
    ORDER BY connect_time DESC
    LIMIT $${paramIdx}
  `, params);
  return result.rows;
}

// ─── Time Patterns ──────────────────────────────────────────────────────────

export async function getTimePatterns() {
  // Hourly distribution
  const hourly = await queryCharging(`
    SELECT 
      EXTRACT(HOUR FROM connect_time) as hour,
      COUNT(*) as session_count,
      ROUND(AVG(duration_minutes)::numeric, 1) as avg_duration,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_start_level,
      ROUND(AVG(charge_gained)::numeric, 1) as avg_charge_gained
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY hour
    ORDER BY hour
  `);

  // Day of week distribution
  const daily = await queryCharging(`
    SELECT 
      EXTRACT(DOW FROM connect_time) as day_of_week,
      COUNT(*) as session_count,
      ROUND(AVG(duration_minutes)::numeric, 1) as avg_duration,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_start_level
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY day_of_week
    ORDER BY day_of_week
  `);

  // Heatmap: hour x day_of_week
  const heatmap = await queryCharging(`
    SELECT 
      EXTRACT(DOW FROM connect_time) as day_of_week,
      EXTRACT(HOUR FROM connect_time) as hour,
      COUNT(*) as session_count
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `);

  return { hourly: hourly.rows, daily: daily.rows, heatmap: heatmap.rows };
}

// ─── Duration Distribution ──────────────────────────────────────────────────

export async function getDurationDistribution() {
  const result = await queryCharging(`
    SELECT
      CASE
        WHEN duration_minutes < 5 THEN '0-5 min'
        WHEN duration_minutes < 15 THEN '5-15 min'
        WHEN duration_minutes < 30 THEN '15-30 min'
        WHEN duration_minutes < 60 THEN '30-60 min'
        WHEN duration_minutes < 120 THEN '1-2 hrs'
        WHEN duration_minutes < 240 THEN '2-4 hrs'
        WHEN duration_minutes < 480 THEN '4-8 hrs'
        ELSE '8+ hrs'
      END as bucket,
      CASE
        WHEN duration_minutes < 5 THEN 0
        WHEN duration_minutes < 15 THEN 1
        WHEN duration_minutes < 30 THEN 2
        WHEN duration_minutes < 60 THEN 3
        WHEN duration_minutes < 120 THEN 4
        WHEN duration_minutes < 240 THEN 5
        WHEN duration_minutes < 480 THEN 6
        ELSE 7
      END as bucket_order,
      COUNT(*) as count,
      ROUND(AVG(charge_gained)::numeric, 1) as avg_charge_gained
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);
  return result.rows;
}

// ─── Level Distribution ─────────────────────────────────────────────────────

export async function getLevelDistribution() {
  const connect = await queryCharging(`
    SELECT
      (FLOOR(start_percentage / 10) * 10)::int as level_bucket,
      COUNT(*) as count
    FROM charging_sessions
    GROUP BY level_bucket
    ORDER BY level_bucket
  `);

  const disconnect = await queryCharging(`
    SELECT
      (FLOOR(end_percentage / 10) * 10)::int as level_bucket,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY level_bucket
    ORDER BY level_bucket
  `);

  return { connect: connect.rows, disconnect: disconnect.rows };
}

// ─── Anomalous Users ────────────────────────────────────────────────────────

export async function getAnomalousUsers() {
  const result = await queryCharging(`
    SELECT 
      user_id, total_events, connect_count, disconnect_count,
      event_mismatch, total_sessions, complete_sessions,
      ROUND(avg_duration_minutes::numeric, 1) as avg_duration_minutes,
      ROUND(avg_charge_gained::numeric, 1) as avg_charge_gained,
      first_event, last_event
    FROM user_stats
    WHERE is_anomalous = TRUE
    ORDER BY event_mismatch DESC
  `);
  return result.rows;
}

// ─── Anomaly Impact Analysis ────────────────────────────────────────────────

export async function getAnomalyImpact() {
  const result = await queryCharging(`
    WITH anomalous AS (
      SELECT user_id FROM user_stats WHERE is_anomalous = TRUE
    ),
    all_stats AS (
      SELECT
        COUNT(*) as total_users,
        SUM(total_events) as total_events,
        SUM(total_sessions) as total_sessions,
        SUM(complete_sessions) as complete_sessions,
        ROUND(AVG(avg_duration_minutes)::numeric, 1) as avg_duration,
        ROUND(AVG(avg_charge_gained)::numeric, 1) as avg_charge
      FROM user_stats
    ),
    anomalous_stats AS (
      SELECT
        COUNT(*) as anomalous_users,
        SUM(total_events) as anomalous_events,
        SUM(total_sessions) as anomalous_sessions,
        SUM(complete_sessions) as anomalous_complete,
        ROUND(AVG(avg_duration_minutes)::numeric, 1) as anomalous_avg_duration,
        ROUND(AVG(avg_charge_gained)::numeric, 1) as anomalous_avg_charge
      FROM user_stats
      WHERE user_id IN (SELECT user_id FROM anomalous)
    ),
    clean_stats AS (
      SELECT
        COUNT(*) as clean_users,
        SUM(total_events) as clean_events,
        SUM(total_sessions) as clean_sessions,
        SUM(complete_sessions) as clean_complete,
        ROUND(AVG(avg_duration_minutes)::numeric, 1) as clean_avg_duration,
        ROUND(AVG(avg_charge_gained)::numeric, 1) as clean_avg_charge
      FROM user_stats
      WHERE user_id NOT IN (SELECT user_id FROM anomalous)
    )
    SELECT
      a.total_users, a.total_events, a.total_sessions, a.complete_sessions,
      a.avg_duration, a.avg_charge,
      n.anomalous_users, n.anomalous_events, n.anomalous_sessions, n.anomalous_complete,
      n.anomalous_avg_duration, n.anomalous_avg_charge,
      c.clean_users, c.clean_events, c.clean_sessions, c.clean_complete,
      c.clean_avg_duration, c.clean_avg_charge,
      ROUND(n.anomalous_users::numeric / a.total_users * 100, 1) as pct_users,
      ROUND(n.anomalous_events::numeric / a.total_events * 100, 1) as pct_events,
      ROUND(n.anomalous_sessions::numeric / a.total_sessions * 100, 1) as pct_sessions
    FROM all_stats a, anomalous_stats n, clean_stats c
  `);
  return result.rows[0];
}

// ─── Charge Gained Distribution ─────────────────────────────────────────────

export async function getChargeGainedDistribution() {
  const result = await queryCharging(`
    SELECT
      CASE
        WHEN charge_gained < 0 THEN 'Negative'
        WHEN charge_gained = 0 THEN '0%'
        WHEN charge_gained <= 10 THEN '1-10%'
        WHEN charge_gained <= 20 THEN '11-20%'
        WHEN charge_gained <= 30 THEN '21-30%'
        WHEN charge_gained <= 50 THEN '31-50%'
        WHEN charge_gained <= 70 THEN '51-70%'
        WHEN charge_gained <= 90 THEN '71-90%'
        ELSE '91-100%'
      END as bucket,
      CASE
        WHEN charge_gained < 0 THEN 0
        WHEN charge_gained = 0 THEN 1
        WHEN charge_gained <= 10 THEN 2
        WHEN charge_gained <= 20 THEN 3
        WHEN charge_gained <= 30 THEN 4
        WHEN charge_gained <= 50 THEN 5
        WHEN charge_gained <= 70 THEN 6
        WHEN charge_gained <= 90 THEN 7
        ELSE 8
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);
  return result.rows;
}

// ─── CDF Data (battery level at charge start + duration) ────────────────────

export async function getCDFs() {
  // CDF of battery level at start of charging sessions
  const levelCdf = await queryCharging(`
    WITH ordered AS (
      SELECT start_percentage as level,
        ROW_NUMBER() OVER (ORDER BY start_percentage) as rn,
        COUNT(*) OVER () as total
      FROM charging_sessions
      WHERE is_complete = TRUE
    )
    SELECT level as x,
      ROUND((rn::numeric / total), 4) as cdf
    FROM ordered
    ORDER BY level
  `);

  // CDF of charging session durations (capped at 150 mins for readability)
  const durationCdf = await queryCharging(`
    WITH ordered AS (
      SELECT LEAST(duration_minutes, 150) as duration,
        ROW_NUMBER() OVER (ORDER BY duration_minutes) as rn,
        COUNT(*) OVER () as total
      FROM charging_sessions
      WHERE is_complete = TRUE AND duration_minutes >= 0
    )
    SELECT duration as x,
      ROUND((rn::numeric / total), 4) as cdf
    FROM ordered
    ORDER BY duration
  `);

  // Downsample to ~200 points each for chart performance
  const sample = (rows: { x: number; cdf: number }[], maxPoints = 200) => {
    if (rows.length <= maxPoints) return rows;
    const step = Math.ceil(rows.length / maxPoints);
    const sampled = rows.filter((_, i) => i % step === 0);
    // Always include the last point
    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) {
      sampled.push(rows[rows.length - 1]);
    }
    return sampled;
  };

  return {
    levelCdf: sample(levelCdf.rows as any),
    durationCdf: sample(durationCdf.rows as any),
  };
}

// ─── Daily Session Counts (Timeline) ────────────────────────────────────────

export async function getDailySessionCounts() {
  const result = await queryCharging(`
    SELECT
      DATE(connect_time) as date,
      COUNT(*) as session_count,
      COUNT(*) FILTER (WHERE is_complete = TRUE) as complete_count,
      ROUND(AVG(duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as avg_duration,
      COUNT(DISTINCT user_id) as active_users
    FROM charging_sessions
    GROUP BY date
    ORDER BY date
  `);
  return result.rows;
}

// ─── Comparison: All Users vs Clean Users (mismatch ≤ 10) ───────────────────
// "Clean" = not anomalous OR anomalous with mismatch ≤ 10
// "All" = everyone (172 users including high-mismatch anomalies)

export async function getComparison() {
  const result = await queryCharging(`
    WITH clean_users AS (
      SELECT user_id FROM user_stats
      WHERE event_mismatch <= 10
    ),
    all_sessions AS (
      SELECT
        COUNT(*) FILTER (WHERE is_complete) as complete_sessions,
        COUNT(*) as total_sessions,
        (SELECT COUNT(*) FROM user_stats) as total_users,
        ROUND(AVG(start_percentage)::numeric, 1) as avg_connect_level,
        ROUND(AVG(end_percentage) FILTER (WHERE is_complete)::numeric, 1) as avg_disconnect_level,
        ROUND(AVG(charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0)::numeric, 1) as avg_charge_gained,
        ROUND(AVG(duration_minutes) FILTER (WHERE is_complete)::numeric, 1) as avg_duration,
        ROUND(STDDEV(duration_minutes) FILTER (WHERE is_complete)::numeric, 1) as stddev_duration,
        ROUND(STDDEV(charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0)::numeric, 1) as stddev_charge,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) FILTER (WHERE is_complete) as median_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0) as median_charge
      FROM charging_sessions
    ),
    clean_sessions AS (
      SELECT
        COUNT(*) FILTER (WHERE is_complete) as complete_sessions,
        COUNT(*) as total_sessions,
        (SELECT COUNT(*) FROM user_stats WHERE event_mismatch <= 10) as total_users,
        ROUND(AVG(start_percentage)::numeric, 1) as avg_connect_level,
        ROUND(AVG(end_percentage) FILTER (WHERE is_complete)::numeric, 1) as avg_disconnect_level,
        ROUND(AVG(charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0)::numeric, 1) as avg_charge_gained,
        ROUND(AVG(duration_minutes) FILTER (WHERE is_complete)::numeric, 1) as avg_duration,
        ROUND(STDDEV(duration_minutes) FILTER (WHERE is_complete)::numeric, 1) as stddev_duration,
        ROUND(STDDEV(charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0)::numeric, 1) as stddev_charge,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) FILTER (WHERE is_complete) as median_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charge_gained) FILTER (WHERE is_complete AND charge_gained >= 0) as median_charge
      FROM charging_sessions
      WHERE user_id IN (SELECT user_id FROM clean_users)
    )
    SELECT
      a.total_users as all_users, a.total_sessions as all_sessions, a.complete_sessions as all_complete,
      a.avg_connect_level as all_avg_connect, a.avg_disconnect_level as all_avg_disconnect,
      a.avg_charge_gained as all_avg_charge, a.avg_duration as all_avg_duration,
      a.stddev_duration as all_stddev_duration, a.stddev_charge as all_stddev_charge,
      a.median_duration as all_median_duration, a.median_charge as all_median_charge,
      c.total_users as clean_users, c.total_sessions as clean_sessions, c.complete_sessions as clean_complete,
      c.avg_connect_level as clean_avg_connect, c.avg_disconnect_level as clean_avg_disconnect,
      c.avg_charge_gained as clean_avg_charge, c.avg_duration as clean_avg_duration,
      c.stddev_duration as clean_stddev_duration, c.stddev_charge as clean_stddev_charge,
      c.median_duration as clean_median_duration, c.median_charge as clean_median_charge
    FROM all_sessions a, clean_sessions c
  `);

  // Hourly distribution comparison (all vs clean)
  const allHourly = await queryCharging(`
    SELECT EXTRACT(HOUR FROM connect_time)::int as hour, COUNT(*) as count
    FROM charging_sessions WHERE is_complete = TRUE
    GROUP BY hour ORDER BY hour
  `);

  const cleanHourly = await queryCharging(`
    SELECT EXTRACT(HOUR FROM connect_time)::int as hour, COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE
      AND user_id IN (SELECT user_id FROM user_stats WHERE event_mismatch <= 10)
    GROUP BY hour ORDER BY hour
  `);

  // Duration bucket comparison
  const durationBucketSQL = (filter: string) => `
    SELECT
      CASE
        WHEN duration_minutes < 5 THEN '0-5 min'
        WHEN duration_minutes < 15 THEN '5-15 min'
        WHEN duration_minutes < 30 THEN '15-30 min'
        WHEN duration_minutes < 60 THEN '30-60 min'
        WHEN duration_minutes < 120 THEN '1-2 hrs'
        WHEN duration_minutes < 240 THEN '2-4 hrs'
        WHEN duration_minutes < 480 THEN '4-8 hrs'
        ELSE '8+ hrs'
      END as bucket,
      CASE
        WHEN duration_minutes < 5 THEN 0
        WHEN duration_minutes < 15 THEN 1
        WHEN duration_minutes < 30 THEN 2
        WHEN duration_minutes < 60 THEN 3
        WHEN duration_minutes < 120 THEN 4
        WHEN duration_minutes < 240 THEN 5
        WHEN duration_minutes < 480 THEN 6
        ELSE 7
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0 ${filter}
    GROUP BY bucket, bucket_order ORDER BY bucket_order
  `;

  const allDuration = await queryCharging(durationBucketSQL(''));
  const cleanDuration = await queryCharging(
    durationBucketSQL(`AND user_id IN (SELECT user_id FROM user_stats WHERE event_mismatch <= 10)`)
  );

  return {
    summary: result.rows[0],
    allHourly: allHourly.rows,
    cleanHourly: cleanHourly.rows,
    allDuration: allDuration.rows,
    cleanDuration: cleanDuration.rows,
  };
}

// ─── User Date Ranges (how many days of data per user) ──────────────────────
// Note: We count distinct dates with events, not date range span
// Example: Events on Oct 23, 24, 27 = 3 days of data (not 5)

export async function getUserDateRanges() {
  const buckets = await queryCharging(`
    SELECT
      CASE
        WHEN days_of_data <= 3 THEN '1-3 days'
        WHEN days_of_data <= 7 THEN '4-7 days'
        WHEN days_of_data <= 14 THEN '8-14 days'
        WHEN days_of_data <= 21 THEN '15-21 days'
        ELSE '22+ days'
      END as bucket,
      CASE
        WHEN days_of_data <= 3 THEN 0
        WHEN days_of_data <= 7 THEN 1
        WHEN days_of_data <= 14 THEN 2
        WHEN days_of_data <= 21 THEN 3
        ELSE 4
      END as bucket_order,
      COUNT(*) as user_count,
      ROUND(AVG(days_of_data)::numeric, 1) as avg_days
    FROM (
      SELECT user_id,
        COUNT(DISTINCT DATE(event_timestamp)) as days_of_data
      FROM charging_events
      GROUP BY user_id
    ) t
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  const stats = await queryCharging(`
    WITH distinct_days AS (
      SELECT user_id,
        COUNT(DISTINCT DATE(event_timestamp)) as days_of_data
      FROM charging_events
      GROUP BY user_id
    )
    SELECT
      ROUND(AVG(days_of_data)::numeric, 1) as avg_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_of_data)::numeric, 1) as median_days,
      MIN(days_of_data)::int as min_days,
      MAX(days_of_data)::int as max_days,
      COUNT(*) FILTER (WHERE days_of_data <= 5) as short_users,
      COUNT(*) as total_users
    FROM distinct_days
  `);

  const perUser = await queryCharging(`
    SELECT 
      ce.user_id,
      COUNT(DISTINCT DATE(ce.event_timestamp)) as days_of_data,
      us.is_anomalous,
      us.total_sessions
    FROM charging_events ce
    JOIN user_stats us ON ce.user_id = us.user_id
    GROUP BY ce.user_id, us.is_anomalous, us.total_sessions
    ORDER BY days_of_data
  `);

  return {
    buckets: buckets.rows,
    stats: stats.rows[0],
    perUser: perUser.rows,
  };
}

// ─── Deep Analysis (clean users: mismatch ≤ 10 AND ≥ 8 distinct days) ──────

export async function getDeepAnalysis() {
  // Use consistent clean filter: mismatch ≤ 10 AND ≥ 8 distinct days of data
  const cleanFilter = `user_id IN (
    SELECT user_id FROM user_stats us
    WHERE event_mismatch <= 10
      AND (
        SELECT COUNT(DISTINCT DATE(event_timestamp))
        FROM charging_events ce
        WHERE ce.user_id = us.user_id
      ) >= 8
  )`;

  // 1. Peak plug-in time (power_connected by hour)
  const plugInByHour = await queryCharging(`
    SELECT EXTRACT(HOUR FROM event_timestamp)::int as hour, COUNT(*) as count
    FROM charging_events
    WHERE event_type = 'power_connected' AND ${cleanFilter}
    GROUP BY hour ORDER BY hour
  `);

  // 2. Peak unplug time (power_disconnected by hour)
  const plugOutByHour = await queryCharging(`
    SELECT EXTRACT(HOUR FROM event_timestamp)::int as hour, COUNT(*) as count
    FROM charging_events
    WHERE event_type = 'power_disconnected' AND ${cleanFilter}
    GROUP BY hour ORDER BY hour
  `);

  // 3. Average charge target % (i.e., avg end_percentage on complete sessions)
  const chargeTarget = await queryCharging(`
    SELECT
      ROUND(AVG(end_percentage)::numeric, 1) as avg_charge_target,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY end_percentage)::numeric, 1) as median_charge_target,
      (FLOOR(end_percentage / 10) * 10)::int as level_bucket,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND ${cleanFilter}
    GROUP BY level_bucket
    ORDER BY level_bucket
  `);

  const chargeTargetStat = await queryCharging(`
    SELECT
      ROUND(AVG(end_percentage)::numeric, 1) as avg_charge_target,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY end_percentage)::numeric, 0) as median_charge_target,
      COUNT(*) FILTER (WHERE end_percentage >= 90) as full_charge_sessions,
      COUNT(*) FILTER (WHERE end_percentage < 50) as partial_charge_sessions,
      COUNT(*) as total_sessions
    FROM charging_sessions
    WHERE is_complete = TRUE AND ${cleanFilter}
  `);

  // 4. Overnight charging: sessions that span midnight (connect before midnight, disconnect after midnight)
  const overnight = await queryCharging(`
    SELECT
      COUNT(*) FILTER (
        WHERE is_complete = TRUE
          AND EXTRACT(HOUR FROM connect_time) >= 21
          AND EXTRACT(HOUR FROM disconnect_time) <= 8
      ) as overnight_sessions,
      COUNT(DISTINCT user_id) FILTER (
        WHERE is_complete = TRUE
          AND EXTRACT(HOUR FROM connect_time) >= 21
          AND EXTRACT(HOUR FROM disconnect_time) <= 8
      ) as overnight_users,
      COUNT(*) FILTER (WHERE is_complete = TRUE) as total_complete,
      COUNT(DISTINCT user_id) as total_users
    FROM charging_sessions
    WHERE ${cleanFilter}
  `);

  // 5. Usage duration between charges: gap between unplug and next plug-in per user
  const usageBetweenCharges = await queryCharging(`
    WITH session_gaps AS (
      SELECT
        user_id,
        connect_time,
        LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_disconnect,
        EXTRACT(EPOCH FROM (connect_time - LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time))) / 3600.0 as gap_hours
      FROM charging_sessions
      WHERE ${cleanFilter}
    )
    SELECT
      CASE
        WHEN gap_hours < 1 THEN '< 1 hr'
        WHEN gap_hours < 2 THEN '1-2 hrs'
        WHEN gap_hours < 4 THEN '2-4 hrs'
        WHEN gap_hours < 6 THEN '4-6 hrs'
        WHEN gap_hours < 8 THEN '6-8 hrs'
        WHEN gap_hours < 12 THEN '8-12 hrs'
        ELSE '12+ hrs'
      END as bucket,
      CASE
        WHEN gap_hours < 1 THEN 0
        WHEN gap_hours < 2 THEN 1
        WHEN gap_hours < 4 THEN 2
        WHEN gap_hours < 6 THEN 3
        WHEN gap_hours < 8 THEN 4
        WHEN gap_hours < 12 THEN 5
        ELSE 6
      END as bucket_order,
      COUNT(*) as count,
      ROUND(AVG(gap_hours)::numeric, 2) as avg_gap_hours
    FROM session_gaps
    WHERE gap_hours IS NOT NULL AND gap_hours > 0 AND gap_hours < 48
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  const usageGapStat = await queryCharging(`
    WITH session_gaps AS (
      SELECT
        EXTRACT(EPOCH FROM (connect_time - LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time))) / 3600.0 as gap_hours
      FROM charging_sessions
      WHERE ${cleanFilter}
    )
    SELECT
      ROUND(AVG(gap_hours)::numeric, 2) as avg_gap_hours,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_hours)::numeric, 2) as median_gap_hours
    FROM session_gaps
    WHERE gap_hours > 0 AND gap_hours < 48
  `);

  // 6. Battery drain rate: % dropped / hour during usage gaps
  const drainRate = await queryCharging(`
    WITH usage_gaps AS (
      SELECT
        s.user_id,
        s.connect_time,
        s.start_percentage as next_connect_level,
        LAG(s.end_percentage) OVER (PARTITION BY s.user_id ORDER BY s.connect_time) as prev_disconnect_level,
        LAG(s.disconnect_time) OVER (PARTITION BY s.user_id ORDER BY s.connect_time) as prev_disconnect_time,
        EXTRACT(EPOCH FROM (s.connect_time - LAG(s.disconnect_time) OVER (PARTITION BY s.user_id ORDER BY s.connect_time))) / 3600.0 as gap_hours
      FROM charging_sessions s
      WHERE s.is_complete = TRUE AND ${cleanFilter}
    ),
    drain_calc AS (
      SELECT
        gap_hours,
        prev_disconnect_level - next_connect_level as pct_dropped,
        CASE WHEN gap_hours > 0 THEN (prev_disconnect_level - next_connect_level) / gap_hours END as pct_per_hour
      FROM usage_gaps
      WHERE gap_hours >= 1 AND gap_hours < 24
        AND prev_disconnect_level IS NOT NULL
        AND prev_disconnect_level > next_connect_level
        AND (prev_disconnect_level - next_connect_level) / gap_hours < 50
    )
    SELECT
      ROUND(AVG(pct_per_hour)::numeric, 2) as avg_drain_pct_per_hour,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_per_hour)::numeric, 2) as median_drain_pct_per_hour,
      ROUND(AVG(1.0 / NULLIF(pct_per_hour, 0))::numeric, 2) as avg_hours_per_pct,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pct_per_hour)::numeric, 2) as p25_drain,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pct_per_hour)::numeric, 2) as p75_drain,
      -- Drain by time of day (connect hour buckets)
      COUNT(*) as data_points
    FROM drain_calc
  `);

  // Drain rate by hour of day
  const drainByHour = await queryCharging(`
    WITH usage_gaps AS (
      SELECT
        EXTRACT(HOUR FROM LAG(s.disconnect_time) OVER (PARTITION BY s.user_id ORDER BY s.connect_time))::int as usage_start_hour,
        LAG(s.end_percentage) OVER (PARTITION BY s.user_id ORDER BY s.connect_time) as prev_disconnect_level,
        s.start_percentage as next_connect_level,
        EXTRACT(EPOCH FROM (s.connect_time - LAG(s.disconnect_time) OVER (PARTITION BY s.user_id ORDER BY s.connect_time))) / 3600.0 as gap_hours
      FROM charging_sessions s
      WHERE s.is_complete = TRUE AND ${cleanFilter}
    )
    SELECT
      usage_start_hour as hour,
      ROUND(AVG((prev_disconnect_level - next_connect_level) / NULLIF(gap_hours, 0))::numeric, 2) as avg_drain_pct_per_hour,
      COUNT(*) as samples
    FROM usage_gaps
    WHERE gap_hours >= 1 AND gap_hours < 24 AND prev_disconnect_level > next_connect_level
      AND (prev_disconnect_level - next_connect_level) / NULLIF(gap_hours, 0) < 50
    GROUP BY usage_start_hour
    HAVING COUNT(*) >= 5
    ORDER BY usage_start_hour
  `);

  return {
    plugInByHour: plugInByHour.rows,
    plugOutByHour: plugOutByHour.rows,
    chargeTargetDist: chargeTarget.rows,
    chargeTargetStat: chargeTargetStat.rows[0],
    overnight: overnight.rows[0],
    usageBetweenCharges: usageBetweenCharges.rows,
    usageGapStat: usageGapStat.rows[0],
    drainRate: drainRate.rows[0],
    drainByHour: drainByHour.rows,
  };
}

// ─── Battery Level Box Plot ─────────────────────────────────────────────────

export async function getBatteryLevelBoxPlot() {
  const connect = await queryCharging(`
    SELECT
      MIN(start_percentage) as min_val,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY start_percentage) as q1,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY start_percentage) as median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY start_percentage) as q3,
      MAX(start_percentage) as max_val,
      ROUND(AVG(start_percentage)::numeric, 1) as mean,
      COUNT(*) as count
    FROM charging_sessions
  `);

  const disconnect = await queryCharging(`
    SELECT
      MIN(end_percentage) as min_val,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY end_percentage) as q1,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY end_percentage) as median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY end_percentage) as q3,
      MAX(end_percentage) as max_val,
      ROUND(AVG(end_percentage)::numeric, 1) as mean,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE
  `);

  // Compute whisker bounds and outlier counts for connect
  const cRow = connect.rows[0] as any;
  const cIQR = Number(cRow.q3) - Number(cRow.q1);
  const cLower = Math.max(0, Number(cRow.q1) - 1.5 * cIQR);
  const cUpper = Math.min(100, Number(cRow.q3) + 1.5 * cIQR);

  const connectOutliers = await queryCharging(`
    SELECT
      COUNT(*) FILTER (WHERE start_percentage < $1::numeric) as below,
      COUNT(*) FILTER (WHERE start_percentage > $2::numeric) as above,
      MIN(start_percentage) FILTER (WHERE start_percentage >= $1::numeric) as whisker_low,
      MAX(start_percentage) FILTER (WHERE start_percentage <= $2::numeric) as whisker_high
    FROM charging_sessions
  `, [cLower, cUpper]);

  // Compute whisker bounds and outlier counts for disconnect
  const dRow = disconnect.rows[0] as any;
  const dIQR = Number(dRow.q3) - Number(dRow.q1);
  const dLower = Math.max(0, Number(dRow.q1) - 1.5 * dIQR);
  const dUpper = Math.min(100, Number(dRow.q3) + 1.5 * dIQR);

  const disconnectOutliers = await queryCharging(`
    SELECT
      COUNT(*) FILTER (WHERE end_percentage < $1::numeric) as below,
      COUNT(*) FILTER (WHERE end_percentage > $2::numeric) as above,
      MIN(end_percentage) FILTER (WHERE end_percentage >= $1::numeric) as whisker_low,
      MAX(end_percentage) FILTER (WHERE end_percentage <= $2::numeric) as whisker_high
    FROM charging_sessions
    WHERE is_complete = TRUE
  `, [dLower, dUpper]);

  const cOut = connectOutliers.rows[0] as any;
  const dOut = disconnectOutliers.rows[0] as any;

  return {
    connect: {
      min: Number(cRow.min_val), q1: Number(cRow.q1), median: Number(cRow.median),
      q3: Number(cRow.q3), max: Number(cRow.max_val), mean: Number(cRow.mean),
      count: Number(cRow.count),
      whiskerLow: Number(cOut.whisker_low ?? cRow.min_val),
      whiskerHigh: Number(cOut.whisker_high ?? cRow.max_val),
      outliersBelow: Number(cOut.below), outliersAbove: Number(cOut.above),
    },
    disconnect: {
      min: Number(dRow.min_val), q1: Number(dRow.q1), median: Number(dRow.median),
      q3: Number(dRow.q3), max: Number(dRow.max_val), mean: Number(dRow.mean),
      count: Number(dRow.count),
      whiskerLow: Number(dOut.whisker_low ?? dRow.min_val),
      whiskerHigh: Number(dOut.whisker_high ?? dRow.max_val),
      outliersBelow: Number(dOut.below), outliersAbove: Number(dOut.above),
    },
  };
}

// ─── Daily Charging Frequency ───────────────────────────────────────────────

export async function getDailyChargingFrequency() {
  // Distribution: how many user-days had 1, 2, 3, ... charges
  const distribution = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions
      GROUP BY user_id, DATE(connect_time)
    )
    SELECT charges_per_day, COUNT(*) as frequency
    FROM daily_counts
    GROUP BY charges_per_day
    ORDER BY charges_per_day
  `);

  // Overall stats
  const stats = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions
      GROUP BY user_id, DATE(connect_time)
    )
    SELECT
      ROUND(AVG(charges_per_day)::numeric, 2) as mean,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charges_per_day)::numeric, 1) as median,
      ROUND(STDDEV(charges_per_day)::numeric, 2) as stddev,
      MIN(charges_per_day) as min_val,
      MAX(charges_per_day) as max_val,
      COUNT(*) as total_user_days
    FROM daily_counts
  `);

  return {
    distribution: distribution.rows,
    stats: stats.rows[0],
  };
}

// ─── Clean Data Analysis (mismatch ≤ 10 AND ≥ 8 observation days) ───────────

export async function getCleanDataAnalysis() {
  // Dynamic clean filter: mismatch ≤ 10 AND ≥ 8 distinct days of data
  // Note: We count distinct dates with events, not date range span
  const cleanFilter = `user_id IN (
    SELECT user_id FROM user_stats us
    WHERE event_mismatch <= 10
      AND (
        SELECT COUNT(DISTINCT DATE(event_timestamp))
        FROM charging_events ce
        WHERE ce.user_id = us.user_id
      ) >= 8
  )`;

  // Summary stats
  const summary = await queryCharging(`
    SELECT
      (SELECT COUNT(*) FROM user_stats us
       WHERE event_mismatch <= 10
         AND (
           SELECT COUNT(DISTINCT DATE(event_timestamp))
           FROM charging_events ce
           WHERE ce.user_id = us.user_id
         ) >= 8) as total_users,
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE is_complete = TRUE) as complete_sessions,
      ROUND(AVG(duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as avg_duration,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as median_duration,
      ROUND(STDDEV(duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as stddev_duration,
      ROUND(AVG(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as avg_charge_gained,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as median_charge_gained,
      ROUND(STDDEV(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as stddev_charge_gained,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_connect_level,
      ROUND(AVG(end_percentage) FILTER (WHERE is_complete = TRUE)::numeric, 1) as avg_disconnect_level
    FROM charging_sessions
    WHERE ${cleanFilter}
  `);

  // Box plots for 4 metrics
  const boxPlotQuery = async (column: string, extraFilter = '') => {
    const r = await queryCharging(`
      SELECT
        MIN(${column}) as min_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${column}) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${column}) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${column}) as q3,
        MAX(${column}) as max_val,
        ROUND(AVG(${column})::numeric, 2) as mean,
        COUNT(*) as count
      FROM charging_sessions
      WHERE ${cleanFilter} ${extraFilter}
    `);
    const row = r.rows[0] as any;
    const iqr = Number(row.q3) - Number(row.q1);
    const wLow = Number(row.q1) - 1.5 * iqr;
    const wHigh = Number(row.q3) + 1.5 * iqr;

    const outliers = await queryCharging(`
      SELECT
        COUNT(*) FILTER (WHERE ${column} < $1::numeric) as below,
        COUNT(*) FILTER (WHERE ${column} > $2::numeric) as above,
        MIN(${column}) FILTER (WHERE ${column} >= $1::numeric) as whisker_low,
        MAX(${column}) FILTER (WHERE ${column} <= $2::numeric) as whisker_high
      FROM charging_sessions
      WHERE ${cleanFilter} ${extraFilter}
    `, [wLow, wHigh]);
    const o = outliers.rows[0] as any;

    return {
      min: Number(row.min_val), q1: Number(row.q1), median: Number(row.median),
      q3: Number(row.q3), max: Number(row.max_val), mean: Number(row.mean),
      count: Number(row.count),
      whiskerLow: Number(o.whisker_low ?? row.min_val),
      whiskerHigh: Number(o.whisker_high ?? row.max_val),
      outliersBelow: Number(o.below), outliersAbove: Number(o.above),
    };
  };

  const connectBox = await boxPlotQuery('start_percentage');
  const disconnectBox = await boxPlotQuery('end_percentage', 'AND is_complete = TRUE');
  const durationBox = await boxPlotQuery('duration_minutes', 'AND is_complete = TRUE AND duration_minutes >= 0');
  const chargeGainedBox = await boxPlotQuery('charge_gained', 'AND is_complete = TRUE AND charge_gained >= 0');

  // Histograms
  const durationHist = await queryCharging(`
    SELECT
      CASE
        WHEN duration_minutes < 5 THEN '0-5 min'
        WHEN duration_minutes < 15 THEN '5-15 min'
        WHEN duration_minutes < 30 THEN '15-30 min'
        WHEN duration_minutes < 60 THEN '30-60 min'
        WHEN duration_minutes < 120 THEN '1-2 hrs'
        WHEN duration_minutes < 240 THEN '2-4 hrs'
        WHEN duration_minutes < 480 THEN '4-8 hrs'
        ELSE '8+ hrs'
      END as bucket,
      CASE
        WHEN duration_minutes < 5 THEN 0
        WHEN duration_minutes < 15 THEN 1
        WHEN duration_minutes < 30 THEN 2
        WHEN duration_minutes < 60 THEN 3
        WHEN duration_minutes < 120 THEN 4
        WHEN duration_minutes < 240 THEN 5
        WHEN duration_minutes < 480 THEN 6
        ELSE 7
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0 AND ${cleanFilter}
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  const chargeHist = await queryCharging(`
    SELECT
      CASE
        WHEN charge_gained < 0 THEN 'Negative'
        WHEN charge_gained = 0 THEN '0%'
        WHEN charge_gained <= 10 THEN '1-10%'
        WHEN charge_gained <= 20 THEN '11-20%'
        WHEN charge_gained <= 30 THEN '21-30%'
        WHEN charge_gained <= 50 THEN '31-50%'
        WHEN charge_gained <= 70 THEN '51-70%'
        WHEN charge_gained <= 90 THEN '71-90%'
        ELSE '91-100%'
      END as bucket,
      CASE
        WHEN charge_gained < 0 THEN 0
        WHEN charge_gained = 0 THEN 1
        WHEN charge_gained <= 10 THEN 2
        WHEN charge_gained <= 20 THEN 3
        WHEN charge_gained <= 30 THEN 4
        WHEN charge_gained <= 50 THEN 5
        WHEN charge_gained <= 70 THEN 6
        WHEN charge_gained <= 90 THEN 7
        ELSE 8
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND ${cleanFilter}
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  const connectHist = await queryCharging(`
    SELECT
      (FLOOR(start_percentage / 10) * 10)::int as level_bucket,
      COUNT(*) as count
    FROM charging_sessions
    WHERE ${cleanFilter}
    GROUP BY level_bucket
    ORDER BY level_bucket
  `);

  // Scatter plot data: start_percentage vs charge_gained (sampled for performance)
  const scatterStartVsCharge = await queryCharging(`
    SELECT start_percentage, charge_gained, duration_minutes
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained >= 0 AND ${cleanFilter}
    ORDER BY RANDOM()
    LIMIT 2000
  `);

  // Scatter plot: duration vs charge_gained
  const scatterDurationVsCharge = await queryCharging(`
    SELECT duration_minutes, charge_gained, start_percentage
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0 AND charge_gained >= 0 AND ${cleanFilter}
    ORDER BY RANDOM()
    LIMIT 2000
  `);

  return {
    summary: summary.rows[0],
    boxPlots: {
      connectLevel: connectBox,
      disconnectLevel: disconnectBox,
      duration: durationBox,
      chargeGained: chargeGainedBox,
    },
    histograms: {
      duration: durationHist.rows,
      chargeGained: chargeHist.rows,
      connectLevel: connectHist.rows,
    },
    scatterPlots: {
      startVsCharge: scatterStartVsCharge.rows,
      durationVsCharge: scatterDurationVsCharge.rows,
    },
  };
}

// ─── Full Dataset Analysis (ALL users, no filters) ──────────────────────────

export async function getFullDatasetAnalysis() {
  // Helper: box plot query with no user filter
  const boxPlotQuery = async (column: string, extraFilter = '') => {
    const r = await queryCharging(`
      SELECT
        MIN(${column}) as min_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${column}) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${column}) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${column}) as q3,
        MAX(${column}) as max_val,
        ROUND(AVG(${column})::numeric, 2) as mean,
        COUNT(*) as count
      FROM charging_sessions
      WHERE TRUE ${extraFilter}
    `);
    const row = r.rows[0] as any;
    const iqr = Number(row.q3) - Number(row.q1);
    const wLow = Number(row.q1) - 1.5 * iqr;
    const wHigh = Number(row.q3) + 1.5 * iqr;

    const outliers = await queryCharging(`
      SELECT
        COUNT(*) FILTER (WHERE ${column} < $1::numeric) as below,
        COUNT(*) FILTER (WHERE ${column} > $2::numeric) as above,
        MIN(${column}) FILTER (WHERE ${column} >= $1::numeric) as whisker_low,
        MAX(${column}) FILTER (WHERE ${column} <= $2::numeric) as whisker_high
      FROM charging_sessions
      WHERE TRUE ${extraFilter}
    `, [wLow, wHigh]);
    const o = outliers.rows[0] as any;

    return {
      min: Number(row.min_val), q1: Number(row.q1), median: Number(row.median),
      q3: Number(row.q3), max: Number(row.max_val), mean: Number(row.mean),
      count: Number(row.count),
      whiskerLow: Number(o.whisker_low ?? row.min_val),
      whiskerHigh: Number(o.whisker_high ?? row.max_val),
      outliersBelow: Number(o.below), outliersAbove: Number(o.above),
    };
  };

  // 1. Summary stats
  const summary = await queryCharging(`
    SELECT
      (SELECT COUNT(*) FROM user_stats) as total_users,
      (SELECT COUNT(*) FROM charging_events) as total_events,
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE is_complete = TRUE) as complete_sessions,
      ROUND(AVG(duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as avg_duration,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as median_duration,
      ROUND(STDDEV(duration_minutes) FILTER (WHERE is_complete = TRUE)::numeric, 1) as stddev_duration,
      ROUND(AVG(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as avg_charge_gained,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as median_charge_gained,
      ROUND(STDDEV(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as stddev_charge_gained,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_connect_level,
      ROUND(AVG(end_percentage) FILTER (WHERE is_complete = TRUE)::numeric, 1) as avg_disconnect_level
    FROM charging_sessions
  `);

  // 2. Box plots
  const connectBox = await boxPlotQuery('start_percentage');
  const disconnectBox = await boxPlotQuery('end_percentage', 'AND is_complete = TRUE');
  const durationBox = await boxPlotQuery('duration_minutes', 'AND is_complete = TRUE AND duration_minutes >= 0');
  const chargeGainedBox = await boxPlotQuery('charge_gained', 'AND is_complete = TRUE AND charge_gained >= 0');

  // 3. CDFs
  const levelCdf = await queryCharging(`
    WITH ordered AS (
      SELECT start_percentage as level,
        ROW_NUMBER() OVER (ORDER BY start_percentage) as rn,
        COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE
    )
    SELECT level as x, ROUND((rn::numeric / total), 4) as cdf
    FROM ordered ORDER BY level
  `);
  const durationCdf = await queryCharging(`
    WITH ordered AS (
      SELECT LEAST(duration_minutes, 150) as duration,
        ROW_NUMBER() OVER (ORDER BY duration_minutes) as rn,
        COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE AND duration_minutes >= 0
    )
    SELECT duration as x, ROUND((rn::numeric / total), 4) as cdf
    FROM ordered ORDER BY duration
  `);
  // CDF for charge gained
  const chargeCdf = await queryCharging(`
    WITH ordered AS (
      SELECT charge_gained as cg,
        ROW_NUMBER() OVER (ORDER BY charge_gained) as rn,
        COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE AND charge_gained >= 0
    )
    SELECT cg as x, ROUND((rn::numeric / total), 4) as cdf
    FROM ordered ORDER BY cg
  `);

  const sample = (rows: any[], maxPoints = 200) => {
    if (rows.length <= maxPoints) return rows;
    const step = Math.ceil(rows.length / maxPoints);
    const sampled = rows.filter((_: any, i: number) => i % step === 0);
    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
    return sampled;
  };

  // 4. Histograms
  const durationHist = await queryCharging(`
    SELECT
      CASE
        WHEN duration_minutes < 5 THEN '0-5 min'
        WHEN duration_minutes < 15 THEN '5-15 min'
        WHEN duration_minutes < 30 THEN '15-30 min'
        WHEN duration_minutes < 60 THEN '30-60 min'
        WHEN duration_minutes < 120 THEN '1-2 hrs'
        WHEN duration_minutes < 240 THEN '2-4 hrs'
        WHEN duration_minutes < 480 THEN '4-8 hrs'
        ELSE '8+ hrs'
      END as bucket,
      CASE
        WHEN duration_minutes < 5 THEN 0
        WHEN duration_minutes < 15 THEN 1
        WHEN duration_minutes < 30 THEN 2
        WHEN duration_minutes < 60 THEN 3
        WHEN duration_minutes < 120 THEN 4
        WHEN duration_minutes < 240 THEN 5
        WHEN duration_minutes < 480 THEN 6
        ELSE 7
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0
    GROUP BY bucket, bucket_order ORDER BY bucket_order
  `);

  const chargeHist = await queryCharging(`
    WITH ordered_sessions AS (
      SELECT *,
        LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_disconnect_time,
        LAG(end_percentage) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_end_pct
      FROM charging_sessions
      WHERE is_complete = TRUE
    ),
    merge_flags AS (
      SELECT *,
        CASE WHEN prev_disconnect_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (connect_time - prev_disconnect_time)) / 60.0 <= 5
          THEN 0 ELSE 1 END as is_new_group
      FROM ordered_sessions
    ),
    groups AS (
      SELECT *,
        SUM(is_new_group) OVER (PARTITION BY user_id ORDER BY connect_time ROWS UNBOUNDED PRECEDING) as grp
      FROM merge_flags
    ),
    merged AS (
      SELECT user_id, grp,
        MIN(start_percentage) as connect_battery,
        MAX(end_percentage) as disconnect_battery,
        MAX(end_percentage) - MIN(start_percentage) as charge_gained,
        EXTRACT(EPOCH FROM (MAX(disconnect_time) - MIN(connect_time))) / 60.0 as duration_minutes,
        COUNT(*) as sessions_in_group
      FROM groups
      GROUP BY user_id, grp
    )
    SELECT
      CASE
        WHEN charge_gained >= 0 AND charge_gained <= 10 THEN '0-10%'
        WHEN charge_gained <= 20 THEN '10-20%'
        WHEN charge_gained <= 30 THEN '20-30%'
        WHEN charge_gained <= 40 THEN '30-40%'
        WHEN charge_gained <= 50 THEN '40-50%'
        WHEN charge_gained <= 60 THEN '50-60%'
        WHEN charge_gained <= 70 THEN '60-70%'
        WHEN charge_gained <= 80 THEN '70-80%'
        WHEN charge_gained <= 90 THEN '80-90%'
        WHEN charge_gained <= 100 THEN '90-100%'
      END as bucket,
      CASE
        WHEN charge_gained >= 0 AND charge_gained <= 10 THEN 0
        WHEN charge_gained <= 20 THEN 1
        WHEN charge_gained <= 30 THEN 2
        WHEN charge_gained <= 40 THEN 3
        WHEN charge_gained <= 50 THEN 4
        WHEN charge_gained <= 60 THEN 5
        WHEN charge_gained <= 70 THEN 6
        WHEN charge_gained <= 80 THEN 7
        WHEN charge_gained <= 90 THEN 8
        WHEN charge_gained <= 100 THEN 9
      END as bucket_order,
      COUNT(*) as count
    FROM merged
    WHERE charge_gained >= 0 AND charge_gained <= 100
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  // Merge stats for charge gained
  const chargeHist_mergeStats = await queryCharging(`
    WITH ordered_sessions AS (
      SELECT *,
        LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_disconnect_time
      FROM charging_sessions
      WHERE is_complete = TRUE
    ),
    merge_flags AS (
      SELECT *,
        CASE WHEN prev_disconnect_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (connect_time - prev_disconnect_time)) / 60.0 <= 5
          THEN 0 ELSE 1 END as is_new_group
      FROM ordered_sessions
    ),
    groups AS (
      SELECT *,
        SUM(is_new_group) OVER (PARTITION BY user_id ORDER BY connect_time ROWS UNBOUNDED PRECEDING) as grp
      FROM merge_flags
    ),
    merged AS (
      SELECT user_id, grp,
        MAX(end_percentage) - MIN(start_percentage) as charge_gained,
        COUNT(*) as sessions_in_group
      FROM groups
      GROUP BY user_id, grp
    )
    SELECT
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE) as original_sessions,
      COUNT(*) as merged_sessions,
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE) - COUNT(*) as sessions_merged_away,
      COUNT(*) FILTER (WHERE charge_gained < 0) as negative_excluded,
      COUNT(*) FILTER (WHERE charge_gained > 100) as above_100_excluded,
      COUNT(*) FILTER (WHERE charge_gained >= 0 AND charge_gained <= 100) as sessions_in_chart
    FROM merged
  `);


  const connectLevelHist = await queryCharging(`
    SELECT (FLOOR(start_percentage / 10) * 10)::int as level_bucket, COUNT(*) as count
    FROM charging_sessions
    GROUP BY level_bucket ORDER BY level_bucket
  `);

  const disconnectLevelHist = await queryCharging(`
    SELECT (FLOOR(end_percentage / 10) * 10)::int as level_bucket, COUNT(*) as count
    FROM charging_sessions WHERE is_complete = TRUE
    GROUP BY level_bucket ORDER BY level_bucket
  `);

  // 5. Daily charging frequency
  const dailyFreqDist = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions GROUP BY user_id, DATE(connect_time)
    )
    SELECT charges_per_day, COUNT(*) as frequency
    FROM daily_counts GROUP BY charges_per_day ORDER BY charges_per_day
  `);
  const dailyFreqStats = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions GROUP BY user_id, DATE(connect_time)
    )
    SELECT
      ROUND(AVG(charges_per_day)::numeric, 2) as mean,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charges_per_day)::numeric, 1) as median,
      ROUND(STDDEV(charges_per_day)::numeric, 2) as stddev,
      MIN(charges_per_day) as min_val, MAX(charges_per_day) as max_val,
      COUNT(*) as total_user_days
    FROM daily_counts
  `);

  // 6. Hourly patterns
  const hourlyPattern = await queryCharging(`
    SELECT EXTRACT(HOUR FROM connect_time)::int as hour,
      COUNT(*) as session_count,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_start_level,
      ROUND(AVG(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as avg_charge_gained
    FROM charging_sessions
    GROUP BY hour ORDER BY hour
  `);

  // 7. Heatmap (day of week × hour)
  const heatmap = await queryCharging(`
    SELECT EXTRACT(DOW FROM connect_time)::int as day_of_week,
      EXTRACT(HOUR FROM connect_time)::int as hour,
      COUNT(*) as session_count
    FROM charging_sessions
    GROUP BY day_of_week, hour ORDER BY day_of_week, hour
  `);

  // 8. Scatter plots (sampled)
  const scatterStartVsCharge = await queryCharging(`
    SELECT start_percentage, charge_gained, duration_minutes
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained >= 0
    ORDER BY RANDOM() LIMIT 2000
  `);
  const scatterDurationVsCharge = await queryCharging(`
    SELECT duration_minutes, charge_gained, start_percentage
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0 AND charge_gained >= 0
    ORDER BY RANDOM() LIMIT 2000
  `);

  // Battery Tide: average battery level by hour of day across all users
  const batteryTide = await queryCharging(`
    SELECT
      hour,
      ROUND(AVG(avg_level)::numeric, 1) as avg_battery_level,
      COUNT(*) as user_count
    FROM (
      SELECT
        EXTRACT(HOUR FROM connect_time)::int as hour,
        AVG(start_percentage) as avg_level
      FROM charging_sessions
      WHERE connect_time IS NOT NULL
      GROUP BY user_id, EXTRACT(HOUR FROM connect_time)::int
    ) per_user_hour
    GROUP BY hour
    ORDER BY hour
  `);

  // Transition Matrix: start % vs end % (10% buckets)
  const transitionMatrix = await queryCharging(`
    SELECT
      (FLOOR(start_percentage / 10) * 10)::int as start_bucket,
      (FLOOR(LEAST(end_percentage, 100) / 10) * 10)::int as end_bucket,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND start_percentage >= 0 AND end_percentage >= 0
    GROUP BY start_bucket, end_bucket
    ORDER BY start_bucket, end_bucket
  `);

  return {
    summary: summary.rows[0],
    boxPlots: {
      connectLevel: connectBox,
      disconnectLevel: disconnectBox,
      duration: durationBox,
      chargeGained: chargeGainedBox,
    },
    cdfs: {
      levelCdf: sample(levelCdf.rows as any),
      durationCdf: sample(durationCdf.rows as any),
      chargeCdf: sample(chargeCdf.rows as any),
    },
    histograms: {
      duration: durationHist.rows,
      chargeGained: chargeHist.rows,
      chargeGainedMergeStats: chargeHist_mergeStats.rows[0],
      connectLevel: connectLevelHist.rows,
      disconnectLevel: disconnectLevelHist.rows,
    },
    dailyFrequency: {
      distribution: dailyFreqDist.rows,
      stats: dailyFreqStats.rows[0],
    },
    hourlyPattern: hourlyPattern.rows,
    heatmap: heatmap.rows,
    scatterPlots: {
      startVsCharge: scatterStartVsCharge.rows,
      durationVsCharge: scatterDurationVsCharge.rows,
    },
    batteryTide: batteryTide.rows,
    transitionMatrix: transitionMatrix.rows,
  };
}

// ─── Filtered Dataset Analysis (mismatch + observation period filtering) ─────

export async function getFilteredDatasetAnalysis() {
  const cleanFilter = `user_id IN (
    SELECT user_id FROM user_stats us
    WHERE event_mismatch <= 10
      AND (
        SELECT COUNT(DISTINCT DATE(event_timestamp))
        FROM charging_events ce
        WHERE ce.user_id = us.user_id
      ) >= 8
  )`;

  // 1. Mismatch distribution: every user's mismatch value, bucketed
  const mismatchDist = await queryCharging(`
    SELECT
      CASE
        WHEN event_mismatch = 0 THEN '0 (perfect)'
        WHEN event_mismatch = 1 THEN '1'
        WHEN event_mismatch <= 5 THEN '2-5'
        WHEN event_mismatch <= 10 THEN '6-10'
        WHEN event_mismatch <= 20 THEN '11-20'
        WHEN event_mismatch <= 50 THEN '21-50'
        ELSE '51+'
      END as bucket,
      CASE
        WHEN event_mismatch = 0 THEN 0
        WHEN event_mismatch = 1 THEN 1
        WHEN event_mismatch <= 5 THEN 2
        WHEN event_mismatch <= 10 THEN 3
        WHEN event_mismatch <= 20 THEN 4
        WHEN event_mismatch <= 50 THEN 5
        ELSE 6
      END as bucket_order,
      COUNT(*) as user_count
    FROM user_stats
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  // 2. Observation period distribution: days of data per user, bucketed
  const obsDist = await queryCharging(`
    WITH user_days AS (
      SELECT user_id, COUNT(DISTINCT DATE(event_timestamp)) as obs_days
      FROM charging_events GROUP BY user_id
    )
    SELECT
      CASE
        WHEN obs_days <= 3 THEN '1-3 days'
        WHEN obs_days <= 7 THEN '4-7 days'
        WHEN obs_days <= 14 THEN '8-14 days'
        WHEN obs_days <= 21 THEN '15-21 days'
        WHEN obs_days <= 30 THEN '22-30 days'
        ELSE '31+ days'
      END as bucket,
      CASE
        WHEN obs_days <= 3 THEN 0
        WHEN obs_days <= 7 THEN 1
        WHEN obs_days <= 14 THEN 2
        WHEN obs_days <= 21 THEN 3
        WHEN obs_days <= 30 THEN 4
        ELSE 5
      END as bucket_order,
      COUNT(*) as user_count,
      ROUND(AVG(obs_days)::numeric, 1) as avg_days
    FROM user_days
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  // Observation period stats
  const obsStats = await queryCharging(`
    WITH user_days AS (
      SELECT user_id, COUNT(DISTINCT DATE(event_timestamp)) as obs_days
      FROM charging_events GROUP BY user_id
    )
    SELECT
      ROUND(AVG(obs_days)::numeric, 1) as avg_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY obs_days)::numeric, 0) as median_days,
      MIN(obs_days)::int as min_days,
      MAX(obs_days)::int as max_days
    FROM user_days
  `);

  // 3. Filter funnel — how many users pass each criterion
  const filterFunnel = await queryCharging(`
    WITH user_days AS (
      SELECT ce.user_id, COUNT(DISTINCT DATE(ce.event_timestamp)) as obs_days
      FROM charging_events ce GROUP BY ce.user_id
    )
    SELECT
      (SELECT COUNT(*) FROM user_stats) as all_users,
      (SELECT COUNT(*) FROM user_stats WHERE event_mismatch <= 10) as mismatch_pass,
      (SELECT COUNT(*) FROM user_days WHERE obs_days >= 8) as obs_pass,
      (SELECT COUNT(*) FROM user_stats us
       JOIN user_days ud ON us.user_id = ud.user_id
       WHERE us.event_mismatch <= 10 AND ud.obs_days >= 8) as both_pass
  `);

  // 4. Full vs Filtered comparison — summary stats side by side
  const comparison = await queryCharging(`
    WITH filtered AS (
      SELECT * FROM charging_sessions WHERE ${cleanFilter}
    )
    SELECT
      -- Full dataset
      (SELECT COUNT(*) FROM user_stats) as full_users,
      (SELECT COUNT(*) FROM charging_sessions) as full_sessions,
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE) as full_complete,
      (SELECT ROUND(AVG(duration_minutes)::numeric, 1) FROM charging_sessions WHERE is_complete = TRUE) as full_avg_duration,
      (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes)::numeric, 1) FROM charging_sessions WHERE is_complete = TRUE) as full_median_duration,
      (SELECT ROUND(AVG(charge_gained)::numeric, 1) FROM charging_sessions WHERE is_complete = TRUE AND charge_gained >= 0) as full_avg_charge,
      (SELECT ROUND(AVG(start_percentage)::numeric, 1) FROM charging_sessions) as full_avg_connect,
      (SELECT ROUND(AVG(end_percentage)::numeric, 1) FROM charging_sessions WHERE is_complete = TRUE) as full_avg_disconnect,
      -- Filtered dataset
      (SELECT COUNT(*) FROM user_stats us WHERE event_mismatch <= 10 AND (SELECT COUNT(DISTINCT DATE(event_timestamp)) FROM charging_events ce WHERE ce.user_id = us.user_id) >= 8) as filt_users,
      (SELECT COUNT(*) FROM filtered) as filt_sessions,
      (SELECT COUNT(*) FROM filtered WHERE is_complete = TRUE) as filt_complete,
      (SELECT ROUND(AVG(duration_minutes)::numeric, 1) FROM filtered WHERE is_complete = TRUE) as filt_avg_duration,
      (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes)::numeric, 1) FROM filtered WHERE is_complete = TRUE) as filt_median_duration,
      (SELECT ROUND(AVG(charge_gained)::numeric, 1) FROM filtered WHERE is_complete = TRUE AND charge_gained >= 0) as filt_avg_charge,
      (SELECT ROUND(AVG(start_percentage)::numeric, 1) FROM filtered) as filt_avg_connect,
      (SELECT ROUND(AVG(end_percentage)::numeric, 1) FROM filtered WHERE is_complete = TRUE) as filt_avg_disconnect
  `);

  // 5. Filtered analysis — same comprehensive analysis on filtered data
  // Box plots
  const filtBoxPlot = async (column: string, extraFilter = '') => {
    const r = await queryCharging(`
      SELECT
        MIN(${column}) as min_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${column}) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${column}) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${column}) as q3,
        MAX(${column}) as max_val,
        ROUND(AVG(${column})::numeric, 2) as mean,
        COUNT(*) as count
      FROM charging_sessions
      WHERE ${cleanFilter} ${extraFilter}
    `);
    const row = r.rows[0] as any;
    const iqr = Number(row.q3) - Number(row.q1);
    const wLow = Number(row.q1) - 1.5 * iqr;
    const wHigh = Number(row.q3) + 1.5 * iqr;

    const outliers = await queryCharging(`
      SELECT
        COUNT(*) FILTER (WHERE ${column} < $1::numeric) as below,
        COUNT(*) FILTER (WHERE ${column} > $2::numeric) as above,
        MIN(${column}) FILTER (WHERE ${column} >= $1::numeric) as whisker_low,
        MAX(${column}) FILTER (WHERE ${column} <= $2::numeric) as whisker_high
      FROM charging_sessions
      WHERE ${cleanFilter} ${extraFilter}
    `, [wLow, wHigh]);
    const o = outliers.rows[0] as any;

    return {
      min: Number(row.min_val), q1: Number(row.q1), median: Number(row.median),
      q3: Number(row.q3), max: Number(row.max_val), mean: Number(row.mean),
      count: Number(row.count),
      whiskerLow: Number(o.whisker_low ?? row.min_val),
      whiskerHigh: Number(o.whisker_high ?? row.max_val),
      outliersBelow: Number(o.below), outliersAbove: Number(o.above),
    };
  };

  const fConnectBox = await filtBoxPlot('start_percentage');
  const fDisconnectBox = await filtBoxPlot('end_percentage', 'AND is_complete = TRUE');
  const fDurationBox = await filtBoxPlot('duration_minutes', 'AND is_complete = TRUE AND duration_minutes >= 0');
  const fChargeBox = await filtBoxPlot('charge_gained', 'AND is_complete = TRUE AND charge_gained >= 0');

  // CDFs for filtered data
  const fLevelCdf = await queryCharging(`
    WITH ordered AS (
      SELECT start_percentage as level, ROW_NUMBER() OVER (ORDER BY start_percentage) as rn, COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE AND ${cleanFilter}
    )
    SELECT level as x, ROUND((rn::numeric / total), 4) as cdf FROM ordered ORDER BY level
  `);
  const fDurCdf = await queryCharging(`
    WITH ordered AS (
      SELECT LEAST(duration_minutes, 150) as duration, ROW_NUMBER() OVER (ORDER BY duration_minutes) as rn, COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE AND duration_minutes >= 0 AND ${cleanFilter}
    )
    SELECT duration as x, ROUND((rn::numeric / total), 4) as cdf FROM ordered ORDER BY duration
  `);
  const fChargeCdf = await queryCharging(`
    WITH ordered AS (
      SELECT charge_gained as cg, ROW_NUMBER() OVER (ORDER BY charge_gained) as rn, COUNT(*) OVER () as total
      FROM charging_sessions WHERE is_complete = TRUE AND charge_gained >= 0 AND ${cleanFilter}
    )
    SELECT cg as x, ROUND((rn::numeric / total), 4) as cdf FROM ordered ORDER BY cg
  `);

  const sample = (rows: any[], maxPoints = 200) => {
    if (rows.length <= maxPoints) return rows;
    const step = Math.ceil(rows.length / maxPoints);
    const sampled = rows.filter((_: any, i: number) => i % step === 0);
    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
    return sampled;
  };

  // Histograms for filtered data
  const fDurHist = await queryCharging(`
    SELECT
      CASE
        WHEN duration_minutes < 5 THEN '0-5 min' WHEN duration_minutes < 15 THEN '5-15 min'
        WHEN duration_minutes < 30 THEN '15-30 min' WHEN duration_minutes < 60 THEN '30-60 min'
        WHEN duration_minutes < 120 THEN '1-2 hrs' WHEN duration_minutes < 240 THEN '2-4 hrs'
        WHEN duration_minutes < 480 THEN '4-8 hrs' ELSE '8+ hrs'
      END as bucket,
      CASE
        WHEN duration_minutes < 5 THEN 0 WHEN duration_minutes < 15 THEN 1
        WHEN duration_minutes < 30 THEN 2 WHEN duration_minutes < 60 THEN 3
        WHEN duration_minutes < 120 THEN 4 WHEN duration_minutes < 240 THEN 5
        WHEN duration_minutes < 480 THEN 6 ELSE 7
      END as bucket_order,
      COUNT(*) as count
    FROM charging_sessions WHERE is_complete = TRUE AND duration_minutes >= 0 AND ${cleanFilter}
    GROUP BY bucket, bucket_order ORDER BY bucket_order
  `);

  const fChargeHist = await queryCharging(`
    WITH ordered_sessions AS (
      SELECT *,
        LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_disconnect_time
      FROM charging_sessions
      WHERE is_complete = TRUE AND ${cleanFilter}
    ),
    merge_flags AS (
      SELECT *,
        CASE WHEN prev_disconnect_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (connect_time - prev_disconnect_time)) / 60.0 <= 5
          THEN 0 ELSE 1 END as is_new_group
      FROM ordered_sessions
    ),
    groups AS (
      SELECT *,
        SUM(is_new_group) OVER (PARTITION BY user_id ORDER BY connect_time ROWS UNBOUNDED PRECEDING) as grp
      FROM merge_flags
    ),
    merged AS (
      SELECT user_id, grp,
        MAX(end_percentage) - MIN(start_percentage) as charge_gained,
        COUNT(*) as sessions_in_group
      FROM groups
      GROUP BY user_id, grp
    )
    SELECT
      CASE
        WHEN charge_gained >= 0 AND charge_gained <= 10 THEN '0-10%'
        WHEN charge_gained <= 20 THEN '10-20%'
        WHEN charge_gained <= 30 THEN '20-30%'
        WHEN charge_gained <= 40 THEN '30-40%'
        WHEN charge_gained <= 50 THEN '40-50%'
        WHEN charge_gained <= 60 THEN '50-60%'
        WHEN charge_gained <= 70 THEN '60-70%'
        WHEN charge_gained <= 80 THEN '70-80%'
        WHEN charge_gained <= 90 THEN '80-90%'
        WHEN charge_gained <= 100 THEN '90-100%'
      END as bucket,
      CASE
        WHEN charge_gained >= 0 AND charge_gained <= 10 THEN 0
        WHEN charge_gained <= 20 THEN 1
        WHEN charge_gained <= 30 THEN 2
        WHEN charge_gained <= 40 THEN 3
        WHEN charge_gained <= 50 THEN 4
        WHEN charge_gained <= 60 THEN 5
        WHEN charge_gained <= 70 THEN 6
        WHEN charge_gained <= 80 THEN 7
        WHEN charge_gained <= 90 THEN 8
        WHEN charge_gained <= 100 THEN 9
      END as bucket_order,
      COUNT(*) as count
    FROM merged
    WHERE charge_gained >= 0 AND charge_gained <= 100
    GROUP BY bucket, bucket_order ORDER BY bucket_order
  `);

  const fChargeHist_mergeStats = await queryCharging(`
    WITH ordered_sessions AS (
      SELECT *,
        LAG(disconnect_time) OVER (PARTITION BY user_id ORDER BY connect_time) as prev_disconnect_time
      FROM charging_sessions
      WHERE is_complete = TRUE AND ${cleanFilter}
    ),
    merge_flags AS (
      SELECT *,
        CASE WHEN prev_disconnect_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (connect_time - prev_disconnect_time)) / 60.0 <= 5
          THEN 0 ELSE 1 END as is_new_group
      FROM ordered_sessions
    ),
    groups AS (
      SELECT *,
        SUM(is_new_group) OVER (PARTITION BY user_id ORDER BY connect_time ROWS UNBOUNDED PRECEDING) as grp
      FROM merge_flags
    ),
    merged AS (
      SELECT user_id, grp,
        MAX(end_percentage) - MIN(start_percentage) as charge_gained,
        COUNT(*) as sessions_in_group
      FROM groups
      GROUP BY user_id, grp
    )
    SELECT
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE AND ${cleanFilter}) as original_sessions,
      COUNT(*) as merged_sessions,
      (SELECT COUNT(*) FROM charging_sessions WHERE is_complete = TRUE AND ${cleanFilter}) - COUNT(*) as sessions_merged_away,
      COUNT(*) FILTER (WHERE charge_gained < 0) as negative_excluded,
      COUNT(*) FILTER (WHERE charge_gained > 100) as above_100_excluded,
      COUNT(*) FILTER (WHERE charge_gained >= 0 AND charge_gained <= 100) as sessions_in_chart
    FROM merged
  `);

  const fConnectHist = await queryCharging(`
    SELECT (FLOOR(start_percentage / 10) * 10)::int as level_bucket, COUNT(*) as count
    FROM charging_sessions WHERE ${cleanFilter}
    GROUP BY level_bucket ORDER BY level_bucket
  `);

  const fDisconnectHist = await queryCharging(`
    SELECT (FLOOR(end_percentage / 10) * 10)::int as level_bucket, COUNT(*) as count
    FROM charging_sessions WHERE is_complete = TRUE AND ${cleanFilter}
    GROUP BY level_bucket ORDER BY level_bucket
  `);

  // Hourly pattern for filtered
  const fHourly = await queryCharging(`
    SELECT EXTRACT(HOUR FROM connect_time)::int as hour,
      COUNT(*) as session_count,
      ROUND(AVG(start_percentage)::numeric, 1) as avg_start_level,
      ROUND(AVG(charge_gained) FILTER (WHERE is_complete = TRUE AND charge_gained >= 0)::numeric, 1) as avg_charge_gained
    FROM charging_sessions WHERE ${cleanFilter}
    GROUP BY hour ORDER BY hour
  `);

  // Daily frequency for filtered
  const fDailyFreqDist = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions WHERE ${cleanFilter} GROUP BY user_id, DATE(connect_time)
    )
    SELECT charges_per_day, COUNT(*) as frequency
    FROM daily_counts GROUP BY charges_per_day ORDER BY charges_per_day
  `);
  const fDailyFreqStats = await queryCharging(`
    WITH daily_counts AS (
      SELECT user_id, DATE(connect_time) as day, COUNT(*) as charges_per_day
      FROM charging_sessions WHERE ${cleanFilter} GROUP BY user_id, DATE(connect_time)
    )
    SELECT
      ROUND(AVG(charges_per_day)::numeric, 2) as mean,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charges_per_day)::numeric, 1) as median,
      ROUND(STDDEV(charges_per_day)::numeric, 2) as stddev,
      COUNT(*) as total_user_days
    FROM daily_counts
  `);

  // Scatter plots for filtered
  const fScatter1 = await queryCharging(`
    SELECT start_percentage, charge_gained, duration_minutes
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained >= 0 AND ${cleanFilter}
    ORDER BY RANDOM() LIMIT 2000
  `);
  const fScatter2 = await queryCharging(`
    SELECT duration_minutes, charge_gained, start_percentage
    FROM charging_sessions
    WHERE is_complete = TRUE AND duration_minutes >= 0 AND charge_gained >= 0 AND ${cleanFilter}
    ORDER BY RANDOM() LIMIT 2000
  `);

  // Battery Tide for filtered data
  const fBatteryTide = await queryCharging(`
    SELECT
      hour,
      ROUND(AVG(avg_level)::numeric, 1) as avg_battery_level,
      COUNT(*) as user_count
    FROM (
      SELECT
        EXTRACT(HOUR FROM connect_time)::int as hour,
        AVG(start_percentage) as avg_level
      FROM charging_sessions
      WHERE connect_time IS NOT NULL AND ${cleanFilter}
      GROUP BY user_id, EXTRACT(HOUR FROM connect_time)::int
    ) per_user_hour
    GROUP BY hour
    ORDER BY hour
  `);

  // Transition Matrix for filtered data
  const fTransitionMatrix = await queryCharging(`
    SELECT
      (FLOOR(start_percentage / 10) * 10)::int as start_bucket,
      (FLOOR(LEAST(end_percentage, 100) / 10) * 10)::int as end_bucket,
      COUNT(*) as count
    FROM charging_sessions
    WHERE is_complete = TRUE AND start_percentage >= 0 AND end_percentage >= 0 AND ${cleanFilter}
    GROUP BY start_bucket, end_bucket
    ORDER BY start_bucket, end_bucket
  `);

  return {
    mismatchDist: mismatchDist.rows,
    obsDist: obsDist.rows,
    obsStats: obsStats.rows[0],
    filterFunnel: filterFunnel.rows[0],
    comparison: comparison.rows[0],
    filteredAnalysis: {
      boxPlots: {
        connectLevel: fConnectBox,
        disconnectLevel: fDisconnectBox,
        duration: fDurationBox,
        chargeGained: fChargeBox,
      },
      cdfs: {
        levelCdf: sample(fLevelCdf.rows as any),
        durationCdf: sample(fDurCdf.rows as any),
        chargeCdf: sample(fChargeCdf.rows as any),
      },
      histograms: {
        duration: fDurHist.rows,
        chargeGained: fChargeHist.rows,
        chargeGainedMergeStats: fChargeHist_mergeStats.rows[0],
        connectLevel: fConnectHist.rows,
        disconnectLevel: fDisconnectHist.rows,
      },
      hourlyPattern: fHourly.rows,
      dailyFrequency: {
        distribution: fDailyFreqDist.rows,
        stats: fDailyFreqStats.rows[0],
      },
      scatterPlots: {
        startVsCharge: fScatter1.rows,
        durationVsCharge: fScatter2.rows,
      },
      batteryTide: fBatteryTide.rows,
      transitionMatrix: fTransitionMatrix.rows,
    },
  };
}
