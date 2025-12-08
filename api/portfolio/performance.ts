import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    performance: [],
    totalPnl: 0,
    totalPnlPercent: 0
  });
});
