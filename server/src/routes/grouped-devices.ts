import { Elysia, t } from 'elysia';
import * as groupedAnalytics from '../services/grouped-analytics';

export const groupedDeviceRoutes = new Elysia({ prefix: '/api/grouped/devices' })
  
  .get('/', async () => {
    const data = await groupedAnalytics.getDevices();
    return { data, count: data.length };
  })
  
  .get('/:device_id/:group_id', async ({ params }) => {
    const devices = await groupedAnalytics.getDevices();
    const device = devices.find(
      d => d.device_id === params.device_id && d.group_id === params.group_id
    );
    if (!device) {
      return { error: 'Device not found', status: 404 };
    }
    
    const [chargingStats, appUsage] = await Promise.all([
      groupedAnalytics.getChargingStats(params.device_id, params.group_id),
      groupedAnalytics.getAppUsage(params.device_id, params.group_id, 'app', 10)
    ]);
    
    return {
      data: {
        ...device,
        charging_stats: chargingStats,
        top_apps: appUsage
      }
    };
  }, {
    params: t.Object({
      device_id: t.String(),
      group_id: t.String()
    })
  });
