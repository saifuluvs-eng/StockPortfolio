import app from '../server/index';

export default async function handler(req: any, res: any) {
  // Pass the request to the Express app
  return app(req, res);
}
