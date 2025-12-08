import { createHandler, sendJson, sendError } from '../lib/serverless';

export default createHandler(async (req, res) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    sendJson(res, { success: true, message: 'Bulk update completed' });
  } else if (req.method === 'DELETE') {
    sendJson(res, { success: true, message: 'Bulk delete completed' });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
