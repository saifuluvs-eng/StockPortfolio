import { createHandler, sendJson, sendError } from './lib/serverless';

export default createHandler(async (req, res) => {
  if (req.method === 'GET') {
    sendJson(res, []);
  } else if (req.method === 'POST') {
    sendJson(res, { success: true, message: 'Watchlist functionality requires authentication' });
  } else if (req.method === 'DELETE') {
    sendJson(res, { success: true, message: 'Item removed' });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
