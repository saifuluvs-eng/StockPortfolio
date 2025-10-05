import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";

const { server, wss } = await import("./server.js");

test("GET /api/health returns ok and timestamp", async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object", "expected server address information");
    const port = address.port;
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.ts, "number");
    assert.ok(Number.isFinite(payload.ts), "timestamp should be a finite number");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    wss.close();
  }
});
