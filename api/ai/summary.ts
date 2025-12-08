import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    data: 'AI summary is temporarily unavailable. Technical analysis indicators are still accessible for your trading decisions.'
  });
});
