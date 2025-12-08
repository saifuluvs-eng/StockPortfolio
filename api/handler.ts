import app, { ready } from '../server/index';

export default async function handler(req: any, res: any) {
  await ready;
  // Pass the request to the Express app
  return app(req, res);
}
