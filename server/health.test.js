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
    assert.ok(
      typeof payload.ts === "number" || typeof payload.ts === "string",
      "timestamp should be a number or string",
    );
    if (typeof payload.ts === "number") {
      assert.ok(Number.isFinite(payload.ts), "numeric timestamp should be finite");
    } else {
      assert.ok(payload.ts.trim().length > 0, "timestamp string should not be empty");
      assert.ok(!Number.isNaN(Date.parse(payload.ts)), "timestamp string should be parseable");
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    wss.close();
  }
});
