import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    strategy: 'AI portfolio analysis is temporarily unavailable.',
    recommendations: []
  });
});
