import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    netWorth: 0,
    history: [],
    lastUpdated: new Date().toISOString()
  });
});
