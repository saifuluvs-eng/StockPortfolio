import { createHandler, sendJson, sendError } from '../lib/serverless';

export default createHandler(async (req, res) => {
  if (req.method === 'GET') {
    sendJson(res, []);
  } else if (req.method === 'POST') {
    sendJson(res, { success: true, id: 'temp-' + Date.now(), message: 'Transaction recorded' });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
