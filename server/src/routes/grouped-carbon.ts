import { Elysia, t } from 'elysia';
import * as carbon from '../services/grouped-carbon';

export const groupedCarbonRoutes = new Elysia({ prefix: '/api/grouped/carbon' })
  
  .get('/summary', async () => {
    const data = await carbon.getCarbonSummary();
    return { data };
  })
  
  .get('/by-device', async ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 50;
    const data = await carbon.getCarbonByDevice(limit);
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      limit: t.Optional(t.String())
    }))
  })
  
  .get('/by-group', async () => {
    const data = await carbon.getCarbonByGroup();
    return { data, count: data.length };
  })
  
  .get('/trends', async () => {
    const data = await carbon.getCarbonTrends();
    return { data, count: data.length };
  })
  
  .get('/comparisons', async () => {
    const data = await carbon.getCarbonComparisons();
    return { data };
  })
  
  .get('/by-time-of-day', async () => {
    const data = await carbon.getCarbonByTimeOfDay();
    return { data };
  })
  
  .get('/insights', async () => {
    const data = await carbon.getCarbonInsights();
    return { data, count: data.length };
  })
  
  .get('/constants', () => ({
    data: {
      carbon_factor: carbon.CARBON_CONSTANTS.CARBON_FACTOR,
      battery_capacity_wh: carbon.CARBON_CONSTANTS.BATTERY_CAPACITY_WH,
      charging_efficiency: carbon.CARBON_CONSTANTS.CHARGING_EFFICIENCY,
      grid_carbon_intensity: carbon.CARBON_CONSTANTS.GRID_CARBON_INTENSITY,
      comparisons: carbon.CARBON_COMPARISONS,
    }
  }));
