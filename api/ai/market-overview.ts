import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    overview: 'AI analysis is temporarily unavailable. Market data and technical indicators are still accessible.',
    timestamp: new Date().toISOString(),
    available: false
  });
});
