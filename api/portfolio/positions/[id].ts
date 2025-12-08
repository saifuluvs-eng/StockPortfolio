import { createHandler, sendJson, sendError } from '../../lib/serverless';

export default createHandler(async (req, res) => {
  const { id } = req.query;
  
  if (req.method === 'GET') {
    sendJson(res, { id, symbol: '', quantity: 0, avgCost: 0 });
  } else if (req.method === 'PUT' || req.method === 'PATCH') {
    sendJson(res, { success: true, id, message: 'Position updated' });
  } else if (req.method === 'DELETE') {
    sendJson(res, { success: true, message: `Position ${id} deleted` });
  } else {
    sendError(res, 405, 'Method not allowed');
  }
});
