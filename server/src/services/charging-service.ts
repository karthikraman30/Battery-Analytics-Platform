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
        COUNT(DISTINCT user_id) as total_users,
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
        COUNT(DISTINCT user_id) as total_users,
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
        GREATEST(1, DATE_PART('day', last_event - first_event) + 1)::int as days_of_data
      FROM user_stats
    ) t
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
  `);

  const stats = await queryCharging(`
    SELECT
      ROUND(AVG(DATE_PART('day', last_event - first_event) + 1)::numeric, 1) as avg_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY DATE_PART('day', last_event - first_event) + 1)::numeric, 1) as median_days,
      MIN(DATE_PART('day', last_event - first_event) + 1)::int as min_days,
      MAX(DATE_PART('day', last_event - first_event) + 1)::int as max_days,
      COUNT(*) FILTER (WHERE DATE_PART('day', last_event - first_event) + 1 <= 5) as short_users,
      COUNT(*) as total_users
    FROM user_stats
  `);

  const perUser = await queryCharging(`
    SELECT user_id,
      GREATEST(1, DATE_PART('day', last_event - first_event) + 1)::int as days_of_data,
      is_anomalous,
      total_sessions
    FROM user_stats
    ORDER BY days_of_data
  `);

  return {
    buckets: buckets.rows,
    stats: stats.rows[0],
    perUser: perUser.rows,
  };
}

// ─── Deep Analysis (clean users: mismatch ≤ 10) ─────────────────────────────

export async function getDeepAnalysis() {
  const cleanFilter = `user_id IN (SELECT user_id FROM user_stats WHERE event_mismatch <= 10)`;

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

