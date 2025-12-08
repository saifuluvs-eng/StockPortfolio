import { createHandler, sendJson, sendError } from '../lib/serverless';

export default createHandler(async (req, res) => {
  const { id } = req.query;
  
  if (req.method === 'DELETE') {
    sendJson(res, { success: true, message: `Watchlist item ${id} removed` });
  } else if (req.method === 'GET') {
    sendJson(res, { id, symbol: '', addedAt: new Date().toISOString() });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
