/**
 * API routes for battery charging data.
 * All endpoints pull from the battery_charging_events database.
 */
import { Elysia, t } from 'elysia';
import * as chargingService from '../services/charging-service';

export const chargingRoutes = new Elysia({ prefix: '/api/charging' })

    // Overall stats
    .get('/stats', async () => {
        const data = await chargingService.getOverallStats();
        return { data };
    })

    // User list
    .get('/users', async ({ query }) => {
        const { sort_by, order, limit } = query;
        const data = await chargingService.getUsers(
            sort_by || 'user_id',
            order || 'asc',
            limit ? parseInt(limit) : 300
        );
        return { data, count: data.length };
    }, {
        query: t.Optional(t.Object({
            sort_by: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
        }))
    })

    // Single user detail
    .get('/users/:userId', async ({ params }) => {
        const data = await chargingService.getUserDetail(parseInt(params.userId));
        return { data };
    }, {
        params: t.Object({
            userId: t.String(),
        })
    })

    // Sessions list
    .get('/sessions', async ({ query }) => {
        const { user_id, complete_only, limit } = query;
        const data = await chargingService.getSessions(
            user_id ? parseInt(user_id) : undefined,
            complete_only === 'true',
            limit ? parseInt(limit) : 500
        );
        return { data, count: data.length };
    }, {
        query: t.Optional(t.Object({
            user_id: t.Optional(t.String()),
            complete_only: t.Optional(t.String()),
            limit: t.Optional(t.String()),
        }))
    })

    // Time patterns (hourly, daily, heatmap)
    .get('/time-patterns', async () => {
        const data = await chargingService.getTimePatterns();
        return { data };
    })

    // Duration distribution
    .get('/duration-distribution', async () => {
        const data = await chargingService.getDurationDistribution();
        return { data };
    })

    // Battery level distribution (connect vs disconnect)
    .get('/level-distribution', async () => {
        const data = await chargingService.getLevelDistribution();
        return { data };
    })

    // Anomalous users (mismatch > 1)
    .get('/anomalous-users', async () => {
        const data = await chargingService.getAnomalousUsers();
        return { data, count: data.length };
    })

    // Anomaly impact analysis
    .get('/anomaly-impact', async () => {
        const data = await chargingService.getAnomalyImpact();
        return { data };
    })

    // Charge gained distribution
    .get('/charge-gained-distribution', async () => {
        const data = await chargingService.getChargeGainedDistribution();
        return { data };
    })

    // CDF data (battery level at charge start + duration)
    .get('/cdfs', async () => {
        const data = await chargingService.getCDFs();
        return { data };
    })

    // Daily session counts timeline
    .get('/daily-sessions', async () => {
        const data = await chargingService.getDailySessionCounts();
        return { data };
    })

    // Comparison: All users vs Clean users (mismatch <= 10)
    .get('/comparison', async () => {
        const data = await chargingService.getComparison();
        return { data };
    })

    // User date ranges (how many days of data per user)
    .get('/user-date-ranges', async () => {
        const data = await chargingService.getUserDateRanges();
        return { data };
    })

    // Deep analysis (clean users only: mismatch <= 10)
    .get('/deep-analysis', async () => {
        const data = await chargingService.getDeepAnalysis();
        return { data };
    })

    // Battery level box plot (connect vs disconnect percentiles)
    .get('/level-boxplot', async () => {
        const data = await chargingService.getBatteryLevelBoxPlot();
        return { data };
    })

    // Daily charging frequency (how many charges per day)
    .get('/daily-charge-frequency', async () => {
        const data = await chargingService.getDailyChargingFrequency();
        return { data };
    })

    // Clean data analysis (mismatch ≤ 10, ≥ 8 observation days)
    .get('/clean-analysis', async () => {
        const data = await chargingService.getCleanDataAnalysis();
        return { data };
    });
