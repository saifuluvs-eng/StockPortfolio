import { createServer } from 'http';
import { createApp } from './server.local';

async function main() {
  const app = await createApp({});
  const httpServer = createServer(app as any);
  (app as any).set('httpServer', httpServer);

  const port = Number(process.env.PORT || 5000);
  const host = '0.0.0.0';
  
  httpServer.listen(port, host, () => {
    console.log(`[Replit] Server listening on http://${host}:${port}`);
  });
}

main().catch((e) => {
  console.error('[server] failed to start', e);
  process.exit(1);
});

