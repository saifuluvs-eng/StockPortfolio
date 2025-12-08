import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    data: 'Chart analysis is temporarily unavailable. Please review the technical indicators for trading insights.'
  });
});
