import { createHandler, sendJson } from '../../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    summary: {
      dailyPnl: 0,
      weeklyPnl: 0,
      monthlyPnl: 0,
      allTimePnl: 0
    },
    lastUpdated: new Date().toISOString()
  });
});
