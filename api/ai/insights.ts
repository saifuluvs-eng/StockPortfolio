import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    insights: [],
    message: 'AI insights are temporarily unavailable.'
  });
});
