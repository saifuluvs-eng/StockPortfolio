import { createHandler, sendJson } from './lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});
