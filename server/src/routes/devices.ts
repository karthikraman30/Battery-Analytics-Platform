import { Elysia, t } from 'elysia';
import * as analytics from '../services/analytics';

export const deviceRoutes = new Elysia({ prefix: '/api/devices' })
  
  .get('/', async () => {
    const data = await analytics.getDevices();
    return { data, count: data.length };
  })
  
  .get('/:device_id/:group_id', async ({ params }) => {
    const devices = await analytics.getDevices();
    const device = devices.find(
      d => d.device_id === params.device_id && d.group_id === params.group_id
    );
    if (!device) {
      return { error: 'Device not found', status: 404 };
    }
    
    const [chargingStats, appUsage] = await Promise.all([
      analytics.getChargingStats(params.device_id, params.group_id),
      analytics.getAppUsage(params.device_id, params.group_id, 'app', 10)
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
