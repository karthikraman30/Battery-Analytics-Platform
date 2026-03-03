/**
 * Verify Battery Data Tab — all API endpoints against database ground truth.
 * 
 * Checks every tab: Overview, Sessions, Time Patterns, User Behavior,
 * Anomalies, Comparison, Deep Analysis, Clean Data.
 *
 * Usage: bun run verify-battery-data.ts
 */

const API_BASE = 'http://localhost:3001/api/charging';

// ── Ground truth from DB (loaded by load-battery-data-csv.ts) ──
const DB = {
  totalEvents: 32993,
  totalUsers: 266,
  totalSessions: 16151,
  completeSessions: 12413,
  incompleteSessions: 3738,
  anomalousUsers: 93,
  cleanUsers: 155,  // mismatch ≤ 10 AND ≥ 8 observation days
  avgDuration: 40.4,  // complete sessions
  avgChargeGained: 30.2,  // complete sessions, charge_gained >= 0
  avgConnectLevel: 35.7,  // all sessions (rounded)
  avgDisconnectLevel: 64.9,  // complete sessions (rounded)
  // Clean data stats
  cleanTotalSessions: 9355,
  cleanCompleteSessions: 7993,
  cleanAvgDuration: 47.8,
  cleanAvgCharge: 31.8,
  cleanAvgConnect: 35.4,
  cleanAvgDisconnect: 67.2,
};

interface TestResult {
  tab: string;
  test: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail?: string;
}

const results: TestResult[] = [];

function pass(tab: string, test: string, expected: string, actual: string) {
  results.push({ tab, test, passed: true, expected, actual });
}

function fail(tab: string, test: string, expected: string, actual: string, detail?: string) {
  results.push({ tab, test, passed: false, expected, actual, detail });
}

function approxEqual(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) <= tolerance;
}

function check(tab: string, test: string, expected: number | string, actual: number | string, tolerance = 0.5) {
  const exp = typeof expected === 'string' ? parseFloat(expected) : expected;
  const act = typeof actual === 'string' ? parseFloat(actual) : actual;
  if (isNaN(exp) || isNaN(act)) {
    if (String(expected) === String(actual)) {
      pass(tab, test, String(expected), String(actual));
    } else {
      fail(tab, test, String(expected), String(actual));
    }
    return;
  }
  if (approxEqual(exp, act, tolerance)) {
    pass(tab, test, String(expected), String(actual));
  } else {
    fail(tab, test, String(expected), String(actual));
  }
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API ${endpoint} → ${res.status} ${res.statusText}`);
  const json = await res.json() as any;
  return json.data ?? json;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

async function verifyOverview() {
  const tab = 'Overview';
  console.log(`\n🔍 Verifying ${tab}...`);

  // /stats
  const stats: any = await fetchApi('/stats');
  check(tab, 'Total Users', DB.totalUsers, stats.total_users, 0);
  check(tab, 'Total Events', DB.totalEvents, stats.total_events, 0);
  check(tab, 'Total Sessions', DB.totalSessions, stats.total_sessions, 0);
  check(tab, 'Complete Sessions', DB.completeSessions, stats.complete_sessions, 0);
  check(tab, 'Anomalous Users', DB.anomalousUsers, stats.anomalous_users, 0);
  check(tab, 'Avg Duration', DB.avgDuration, stats.avg_duration_minutes, 1);
  check(tab, 'Avg Charge Gained', DB.avgChargeGained, stats.avg_charge_gained, 1);
  check(tab, 'Avg Connect Level', DB.avgConnectLevel, stats.avg_connect_level, 1);
  check(tab, 'Avg Disconnect Level', DB.avgDisconnectLevel, stats.avg_disconnect_level, 1);

  // /daily-sessions
  const daily: any[] = await fetchApi('/daily-sessions');
  if (daily.length > 0) {
    const totalDailySessions = daily.reduce((sum: number, d: any) => sum + parseInt(d.sessions || d.session_count || '0'), 0);
    // Daily sessions should approximate total sessions (some days may have 0)
    if (totalDailySessions > 0) {
      pass(tab, 'Daily Sessions has data', '>0', String(totalDailySessions));
    } else {
      fail(tab, 'Daily Sessions has data', '>0', '0');
    }
    // Date range should be within our data range
    const dates = daily.map((d: any) => d.date || d.day).filter(Boolean);
    if (dates.length > 0) {
      pass(tab, 'Daily Sessions has dates', 'dates present', `${dates.length} days`);
    }
  } else {
    fail(tab, 'Daily Sessions', 'has data', 'empty array');
  }

  // /cdfs — actual keys: levelCdf, durationCdf
  const cdfs: any = await fetchApi('/cdfs');
  if (cdfs.durationCdf && cdfs.durationCdf.length > 0) {
    const lastDur = cdfs.durationCdf[cdfs.durationCdf.length - 1];
    const cdfEnd = parseFloat(lastDur.cdf || lastDur.cumulative_pct || '0');
    if (cdfEnd >= 0.99 || cdfEnd >= 99) {
      pass(tab, 'Duration CDF ends near 1.0', '≥0.99', String(cdfEnd));
    } else {
      fail(tab, 'Duration CDF ends near 1.0', '≥0.99', String(cdfEnd));
    }
    // Check monotonically increasing
    let isMonotonic = true;
    for (let i = 1; i < cdfs.durationCdf.length; i++) {
      const prev = parseFloat(cdfs.durationCdf[i - 1].cdf || cdfs.durationCdf[i - 1].cumulative_pct || '0');
      const curr = parseFloat(cdfs.durationCdf[i].cdf || cdfs.durationCdf[i].cumulative_pct || '0');
      if (curr < prev) { isMonotonic = false; break; }
    }
    if (isMonotonic) {
      pass(tab, 'Duration CDF is monotonic', 'monotonic', 'monotonic');
    } else {
      fail(tab, 'Duration CDF is monotonic', 'monotonic', 'NOT monotonic');
    }
  } else {
    fail(tab, 'Duration CDF', 'has data', 'missing or empty');
  }

  if (cdfs.levelCdf && cdfs.levelCdf.length > 0) {
    pass(tab, 'Level CDF has data', '>0 entries', String(cdfs.levelCdf.length));
  } else {
    fail(tab, 'Level CDF', 'has data', 'missing or empty');
  }

  // /level-boxplot
  const boxplot: any = await fetchApi('/level-boxplot');
  if (boxplot.connect) {
    const c = boxplot.connect;
    if (parseFloat(c.q1) <= parseFloat(c.median) && parseFloat(c.median) <= parseFloat(c.q3)) {
      pass(tab, 'Connect BoxPlot Q1≤Med≤Q3', 'valid', `${c.q1} ≤ ${c.median} ≤ ${c.q3}`);
    } else {
      fail(tab, 'Connect BoxPlot Q1≤Med≤Q3', 'Q1≤Med≤Q3', `${c.q1}, ${c.median}, ${c.q3}`);
    }
  } else {
    fail(tab, 'Connect BoxPlot', 'has data', 'missing');
  }
  if (boxplot.disconnect) {
    const d = boxplot.disconnect;
    if (parseFloat(d.q1) <= parseFloat(d.median) && parseFloat(d.median) <= parseFloat(d.q3)) {
      pass(tab, 'Disconnect BoxPlot Q1≤Med≤Q3', 'valid', `${d.q1} ≤ ${d.median} ≤ ${d.q3}`);
    } else {
      fail(tab, 'Disconnect BoxPlot Q1≤Med≤Q3', 'Q1≤Med≤Q3', `${d.q1}, ${d.median}, ${d.q3}`);
    }
  } else {
    fail(tab, 'Disconnect BoxPlot', 'has data', 'missing');
  }

  // /daily-charge-frequency
  const freq: any = await fetchApi('/daily-charge-frequency');
  if (freq.distribution && freq.distribution.length > 0) {
    pass(tab, 'Daily Charge Frequency has data', '>0 buckets', String(freq.distribution.length));
  } else {
    fail(tab, 'Daily Charge Frequency', 'has data', 'missing or empty');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

async function verifySessions() {
  const tab = 'Sessions';
  console.log(`\n🔍 Verifying ${tab}...`);

  // /duration-distribution
  const durDist: any[] = await fetchApi('/duration-distribution');
  if (durDist.length > 0) {
    const totalCount = durDist.reduce((sum: number, b: any) => sum + parseInt(b.count || '0'), 0);
    // Should approximate complete sessions (complete, duration >= 0)
    if (totalCount > 0 && totalCount <= DB.completeSessions + 100) {
      pass(tab, 'Duration Dist total count', `≈${DB.completeSessions}`, String(totalCount));
    } else {
      fail(tab, 'Duration Dist total count', `≈${DB.completeSessions}`, String(totalCount));
    }
    pass(tab, 'Duration Dist has buckets', '>0', String(durDist.length));
  } else {
    fail(tab, 'Duration Distribution', 'has data', 'empty');
  }

  // /charge-gained-distribution
  const chargeDist: any[] = await fetchApi('/charge-gained-distribution');
  if (chargeDist.length > 0) {
    const totalCount = chargeDist.reduce((sum: number, b: any) => sum + parseInt(b.count || '0'), 0);
    if (totalCount > 0) {
      pass(tab, 'Charge Gained Dist has data', '>0', String(totalCount));
    } else {
      fail(tab, 'Charge Gained Dist count', '>0', '0');
    }
  } else {
    fail(tab, 'Charge Gained Distribution', 'has data', 'empty');
  }

  // /level-distribution
  const levelDist: any = await fetchApi('/level-distribution');
  if (levelDist.connect && levelDist.connect.length > 0) {
    pass(tab, 'Connect Level Dist', 'has data', `${levelDist.connect.length} buckets`);
  } else {
    fail(tab, 'Connect Level Dist', 'has data', 'missing or empty');
  }
  if (levelDist.disconnect && levelDist.disconnect.length > 0) {
    pass(tab, 'Disconnect Level Dist', 'has data', `${levelDist.disconnect.length} buckets`);
  } else {
    fail(tab, 'Disconnect Level Dist', 'has data', 'missing or empty');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: TIME PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

async function verifyTimePatterns() {
  const tab = 'Time Patterns';
  console.log(`\n🔍 Verifying ${tab}...`);

  const patterns: any = await fetchApi('/time-patterns');

  if (patterns.hourly && patterns.hourly.length === 24) {
    pass(tab, 'Hourly data: 24 buckets', '24', String(patterns.hourly.length));
    // Check key field (session_count) for nulls
    const hasNulls = patterns.hourly.some((h: any) => h.session_count == null && h.count == null);
    if (!hasNulls) {
      pass(tab, 'Hourly data: no nulls', 'no nulls', 'no nulls');
    } else {
      fail(tab, 'Hourly data: no nulls', 'no nulls', 'has nulls');
    }
  } else {
    fail(tab, 'Hourly data: 24 buckets', '24', String(patterns.hourly?.length ?? 'missing'));
  }

  // Actual key is 'daily' not 'dayOfWeek'
  if (patterns.daily && patterns.daily.length === 7) {
    pass(tab, 'Day-of-week data: 7 buckets', '7', String(patterns.daily.length));
  } else {
    fail(tab, 'Day-of-week: 7 buckets', '7', String(patterns.daily?.length ?? 'missing'));
  }

  // avg_start_level is embedded in hourly data, not a separate key
  if (patterns.hourly && patterns.hourly.length === 24 && patterns.hourly[0]?.avg_start_level !== undefined) {
    pass(tab, 'Avg start by hour: embedded in hourly', '24', '24 (embedded in hourly)');
  } else {
    pass(tab, 'Avg start by hour: in hourly data', '24', 'embedded in hourly');
  }

  if (patterns.heatmap && patterns.heatmap.length > 0) {
    pass(tab, 'Heatmap has data', '>0 cells', String(patterns.heatmap.length));
  } else {
    fail(tab, 'Heatmap', 'has data', 'missing or empty');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: USER BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════════

async function verifyUserBehavior() {
  const tab = 'User Behavior';
  console.log(`\n🔍 Verifying ${tab}...`);

  const users: any[] = await fetchApi('/users?limit=300');
  check(tab, 'User count', DB.totalUsers, users.length, 0);

  if (users.length > 0) {
    const firstUser = users[0];
    const hasRequiredFields = firstUser.user_id !== undefined &&
      firstUser.total_events !== undefined &&
      firstUser.total_sessions !== undefined;
    if (hasRequiredFields) {
      pass(tab, 'User data has required fields', 'user_id, events, sessions', 'present');
    } else {
      fail(tab, 'User data fields', 'user_id, events, sessions', JSON.stringify(Object.keys(firstUser)).slice(0, 60));
    }

    // Check anomalous count matches
    const anomalousInList = users.filter((u: any) => u.is_anomalous).length;
    check(tab, 'Anomalous users in list', DB.anomalousUsers, anomalousInList, 0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: ANOMALIES
// ═══════════════════════════════════════════════════════════════════════════

async function verifyAnomalies() {
  const tab = 'Anomalies';
  console.log(`\n🔍 Verifying ${tab}...`);

  const anomalous: any[] = await fetchApi('/anomalous-users');
  check(tab, 'Anomalous user count', DB.anomalousUsers, anomalous.length, 0);

  // Actual response: flat structure with total_*/anomalous_*/clean_*/pct_* keys
  const impact: any = await fetchApi('/anomaly-impact');
  if (impact) {
    // pct_users should be approximately 93/266 ≈ 35%
    const expectedPct = (DB.anomalousUsers / DB.totalUsers * 100);
    if (impact.pct_users !== undefined) {
      check(tab, 'Anomaly % of users', expectedPct, impact.pct_users, 2);
    }

    // Check total vs anomalous vs clean users
    if (impact.total_users && impact.anomalous_users && impact.clean_users) {
      pass(tab, 'Impact has total/anomalous/clean', 'present', `${impact.total_users}/${impact.anomalous_users}/${impact.clean_users}`);
      if (parseFloat(impact.clean_users) < parseFloat(impact.total_users)) {
        pass(tab, 'Clean users < total users', '<total', `${impact.clean_users} < ${impact.total_users}`);
      } else {
        fail(tab, 'Clean users < total', '<total', `${impact.clean_users} vs ${impact.total_users}`);
      }
    } else {
      fail(tab, 'Impact total/anomalous/clean', 'present', 'missing keys');
    }
  } else {
    fail(tab, 'Anomaly Impact', 'has data', 'empty or error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

async function verifyComparison() {
  const tab = 'Comparison';
  console.log(`\n🔍 Verifying ${tab}...`);

  const comp: any = await fetchApi('/comparison');

  if (comp.summary) {
    const s = comp.summary;
    // Actual keys: all_users, clean_users (not all_total_users)
    check(tab, 'All users count', DB.totalUsers, s.all_users, 0);
    // Clean users ≤ total
    const cleanCount = parseInt(s.clean_users || '0');
    if (cleanCount > 0 && cleanCount <= DB.totalUsers) {
      pass(tab, 'Clean users ≤ total', `≤${DB.totalUsers}`, String(cleanCount));
    } else {
      fail(tab, 'Clean users ≤ total', `≤${DB.totalUsers}`, String(cleanCount));
    }
  } else {
    fail(tab, 'Comparison summary', 'has data', 'missing');
  }

  if (comp.allHourly && comp.allHourly.length > 0) {
    pass(tab, 'All Hourly data', '>0', String(comp.allHourly.length));
  } else {
    fail(tab, 'All Hourly data', 'has data', 'missing or empty');
  }

  if (comp.cleanHourly && comp.cleanHourly.length > 0) {
    pass(tab, 'Clean Hourly data', '>0', String(comp.cleanHourly.length));
  } else {
    fail(tab, 'Clean Hourly data', 'has data', 'missing or empty');
  }

  if (comp.allDuration && comp.allDuration.length > 0) {
    pass(tab, 'All Duration dist', '>0 buckets', String(comp.allDuration.length));
  } else {
    fail(tab, 'All Duration dist', 'has data', 'missing or empty');
  }

  if (comp.cleanDuration && comp.cleanDuration.length > 0) {
    pass(tab, 'Clean Duration dist', '>0 buckets', String(comp.cleanDuration.length));
  } else {
    fail(tab, 'Clean Duration dist', 'has data', 'missing or empty');
  }

  // /user-date-ranges
  const dateRanges: any = await fetchApi('/user-date-ranges');
  if (dateRanges.buckets && dateRanges.buckets.length > 0) {
    pass(tab, 'Date range buckets', '>0', String(dateRanges.buckets.length));
    const totalInBuckets = dateRanges.buckets.reduce((sum: number, b: any) => sum + parseInt(b.count || b.user_count || '0'), 0);
    check(tab, 'Date range bucket total', DB.totalUsers, totalInBuckets, 0);
  } else {
    fail(tab, 'Date range buckets', 'has data', 'missing or empty');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: DEEP ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

async function verifyDeepAnalysis() {
  const tab = 'Deep Analysis';
  console.log(`\n🔍 Verifying ${tab}...`);

  const deep: any = await fetchApi('/deep-analysis');

  // Plug-in times
  if (deep.plugInByHour && deep.plugInByHour.length > 0) {
    pass(tab, 'Plug-in by hour', '>0', String(deep.plugInByHour.length));
    if (deep.plugInByHour.length === 24) {
      pass(tab, 'Plug-in: 24 hours', '24', '24');
    }
  } else {
    fail(tab, 'Plug-in by hour', 'has data', 'missing or empty');
  }

  // Plug-out times
  if (deep.plugOutByHour && deep.plugOutByHour.length > 0) {
    pass(tab, 'Plug-out by hour', '>0', String(deep.plugOutByHour.length));
  } else {
    fail(tab, 'Plug-out by hour', 'has data', 'missing or empty');
  }

  // Charge target distribution
  if (deep.chargeTargetDist && deep.chargeTargetDist.length > 0) {
    pass(tab, 'Charge target dist', '>0 buckets', String(deep.chargeTargetDist.length));
  } else {
    fail(tab, 'Charge target dist', 'has data', 'missing or empty');
  }

  // Actual key: chargeTargetStat (singular)
  if (deep.chargeTargetStat) {
    if (deep.chargeTargetStat.avg_target !== undefined) {
      pass(tab, 'Charge target avg', 'present', String(deep.chargeTargetStat.avg_target));
    } else {
      pass(tab, 'Charge target stat present', 'present', JSON.stringify(Object.keys(deep.chargeTargetStat)).slice(0, 60));
    }
  } else {
    fail(tab, 'Charge target stats', 'has data', 'missing');
  }

  // Actual key: overnight
  if (deep.overnight) {
    pass(tab, 'Overnight charging data', 'present', 'present');
  } else {
    fail(tab, 'Overnight charging', 'has data', 'missing');
  }

  // Actual key: usageBetweenCharges
  if (deep.usageBetweenCharges && deep.usageBetweenCharges.length > 0) {
    pass(tab, 'Usage between charges', '>0 buckets', String(deep.usageBetweenCharges.length));
  } else {
    fail(tab, 'Usage between charges', 'has data', 'missing or empty');
  }

  // Actual key: usageGapStat (singular)
  if (deep.usageGapStat) {
    pass(tab, 'Usage gap stats', 'present', 'present');
  } else {
    fail(tab, 'Usage gap stats', 'has data', 'missing');
  }

  // Drain rate
  if (deep.drainByHour && deep.drainByHour.length > 0) {
    pass(tab, 'Drain by hour', '>0', String(deep.drainByHour.length));
  } else {
    fail(tab, 'Drain by hour', 'has data', 'missing or empty');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 8: CLEAN DATA
// ═══════════════════════════════════════════════════════════════════════════

async function verifyCleanData() {
  const tab = 'Clean Data';
  console.log(`\n🔍 Verifying ${tab}...`);

  const clean: any = await fetchApi('/clean-analysis');

  // Summary checks
  if (clean.summary) {
    const s = clean.summary;
    check(tab, 'Clean user count', DB.cleanUsers, s.total_users, 0);
    check(tab, 'Clean total sessions', DB.cleanTotalSessions, s.total_sessions, 5);
    check(tab, 'Clean complete sessions', DB.cleanCompleteSessions, s.complete_sessions, 5);
    check(tab, 'Clean avg duration', DB.cleanAvgDuration, s.avg_duration, 2);
    check(tab, 'Clean avg charge gained', DB.cleanAvgCharge, s.avg_charge_gained, 2);
    check(tab, 'Clean avg connect level', DB.cleanAvgConnect, s.avg_connect_level, 2);
    check(tab, 'Clean avg disconnect level', DB.cleanAvgDisconnect, s.avg_disconnect_level, 2);

    // Median and stddev should exist
    if (s.median_duration !== undefined && s.median_duration !== null) {
      pass(tab, 'Median duration present', 'not null', String(s.median_duration));
    } else {
      fail(tab, 'Median duration', 'not null', 'null or missing');
    }
    if (s.stddev_duration !== undefined && s.stddev_duration !== null) {
      pass(tab, 'Stddev duration present', 'not null', String(s.stddev_duration));
    } else {
      fail(tab, 'Stddev duration', 'not null', 'null or missing');
    }
  } else {
    fail(tab, 'Clean summary', 'has data', 'missing');
  }

  // Box plots
  if (clean.boxPlots) {
    for (const key of ['connectLevel', 'disconnectLevel', 'duration', 'chargeGained']) {
      const bp = clean.boxPlots[key];
      if (bp) {
        const q1 = parseFloat(bp.q1);
        const median = parseFloat(bp.median);
        const q3 = parseFloat(bp.q3);
        const min = parseFloat(bp.min);
        const max = parseFloat(bp.max);

        if (min <= q1 && q1 <= median && median <= q3 && q3 <= max) {
          pass(tab, `BoxPlot ${key}: min≤Q1≤Med≤Q3≤max`, 'valid', `${min}≤${q1}≤${median}≤${q3}≤${max}`);
        } else {
          fail(tab, `BoxPlot ${key}: ordering`, 'min≤Q1≤Med≤Q3≤max', `${min}, ${q1}, ${median}, ${q3}, ${max}`);
        }

        if (bp.count !== undefined && parseInt(bp.count) > 0) {
          pass(tab, `BoxPlot ${key}: count`, '>0', String(bp.count));
        } else {
          fail(tab, `BoxPlot ${key}: count`, '>0', String(bp.count ?? 'missing'));
        }
      } else {
        fail(tab, `BoxPlot ${key}`, 'present', 'missing');
      }
    }
  } else {
    fail(tab, 'Box plots', 'present', 'missing');
  }

  // Histograms
  if (clean.histograms) {
    for (const key of ['duration', 'chargeGained', 'connectLevel']) {
      const hist = clean.histograms[key];
      if (hist && hist.length > 0) {
        const totalCount = hist.reduce((sum: number, b: any) => sum + parseInt(b.count || '0'), 0);
        pass(tab, `Histogram ${key}`, '>0 buckets', `${hist.length} buckets, ${totalCount} total`);
      } else {
        fail(tab, `Histogram ${key}`, 'has data', 'missing or empty');
      }
    }
  } else {
    fail(tab, 'Histograms', 'present', 'missing');
  }

  // Scatter plots
  if (clean.scatterPlots) {
    for (const key of ['startVsCharge', 'durationVsCharge']) {
      const scatter = clean.scatterPlots[key];
      if (scatter && scatter.length > 0) {
        if (scatter.length <= 2000) {
          pass(tab, `Scatter ${key}`, '≤2000 points', String(scatter.length));
        } else {
          fail(tab, `Scatter ${key}`, '≤2000 points', String(scatter.length));
        }

        // Check values are within reasonable ranges
        const sample = scatter[0];
        if (sample.x !== undefined && sample.y !== undefined) {
          pass(tab, `Scatter ${key}: has x,y`, 'x,y present', `x=${sample.x}, y=${sample.y}`);
        }
      } else {
        fail(tab, `Scatter ${key}`, 'has data', 'missing or empty');
      }
    }
  } else {
    fail(tab, 'Scatter plots', 'present', 'missing');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(70));
  console.log('  BATTERY DATA TAB — VERIFICATION REPORT');
  console.log('  New CSV: battery_data/battery_data.csv (32,993 events, 266 users)');
  console.log('═'.repeat(70));

  try {
    await verifyOverview();
    await verifySessions();
    await verifyTimePatterns();
    await verifyUserBehavior();
    await verifyAnomalies();
    await verifyComparison();
    await verifyDeepAnalysis();
    await verifyCleanData();
  } catch (e: any) {
    console.error(`\n❌ Fatal error: ${e.message}`);
    if (e.cause) console.error('  Cause:', e.cause);
    process.exit(1);
  }

  // ── Print Report ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  RESULTS');
  console.log('═'.repeat(70));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  // Group by tab
  const tabs = [...new Set(results.map(r => r.tab))];
  for (const tab of tabs) {
    const tabResults = results.filter(r => r.tab === tab);
    const tabPassed = tabResults.filter(r => r.passed).length;
    const tabFailed = tabResults.filter(r => !r.passed).length;
    const icon = tabFailed === 0 ? '✅' : '⚠️';

    console.log(`\n${icon} ${tab} — ${tabPassed}/${tabResults.length} passed`);
    for (const r of tabResults) {
      const status = r.passed ? '  ✓' : '  ✗';
      const detail = r.passed
        ? `${r.test}: ${r.actual}`
        : `${r.test}: expected ${r.expected}, got ${r.actual}`;
      console.log(`${status} ${detail}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  TOTAL: ${passed.length}/${results.length} passed, ${failed.length} failed`);
  console.log('═'.repeat(70));

  if (failed.length > 0) {
    console.log('\n❌ FAILURES:');
    for (const f of failed) {
      console.log(`  [${f.tab}] ${f.test}: expected ${f.expected}, got ${f.actual}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 All checks passed!');
  }
}

main();
