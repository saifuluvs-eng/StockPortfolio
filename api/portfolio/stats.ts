import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    totalValue: 0,
    totalCost: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    positionCount: 0,
    lastUpdated: new Date().toISOString()
  });
});
