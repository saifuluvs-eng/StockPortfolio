import { createHandler, sendJson, sendError } from '../lib/serverless';

export default createHandler(async (req, res) => {
  if (req.method === 'GET') {
    sendJson(res, {
      positions: [],
      totalValue: 0,
      totalCost: 0,
      totalPnl: 0,
      totalPnlPercent: 0
    });
  } else if (req.method === 'POST') {
    sendJson(res, { success: true, id: 'temp-' + Date.now() });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
