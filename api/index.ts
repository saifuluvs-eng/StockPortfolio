import { createApp } from "./server";

const app = await createApp({
  enableWebSockets: false,
  enableVite: false,
  serveStatic: false,
});

export default app;
