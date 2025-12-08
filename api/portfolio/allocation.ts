import { createHandler, sendJson } from '../lib/serverless';

export default createHandler(async (req, res) => {
  sendJson(res, {
    allocations: [],
    totalValue: 0
  });
});
