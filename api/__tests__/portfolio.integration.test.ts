import { describe, expect, test } from "vitest";
import { getStorage } from "../_lib/serverless";

function uniqueUserId() {
  return `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("portfolio storage integration", () => {
  test("create, read, update, delete positions", async () => {
    const storage = await getStorage();
    const userId = uniqueUserId();
    const symbol = "TESTUSDT";

    const created = await storage.upsertPortfolioPosition(userId, {
      symbol,
      quantity: 10,
      entryPrice: 2.5,
    });

    expect(created.symbol).toBe(symbol);
    expect(created.quantity).toBeCloseTo(10);
    expect(created.entryPrice).toBeCloseTo(2.5);

    let positions = await storage.getPortfolioPositions(userId);
    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe(symbol);

    const upserted = await storage.upsertPortfolioPosition(userId, {
      symbol,
      quantity: 12,
      entryPrice: 3.75,
    });
    expect(upserted.id).toBe(created.id);
    expect(upserted.quantity).toBeCloseTo(12);
    expect(upserted.entryPrice).toBeCloseTo(3.75);

    const patched = await storage.updatePortfolioPosition(created.id, userId, {
      quantity: 15,
    });
    expect(patched).not.toBeNull();
    expect(patched?.quantity).toBeCloseTo(15);

    await storage.deletePortfolioPosition(created.id, userId);
    positions = await storage.getPortfolioPositions(userId);
    expect(positions).toHaveLength(0);
  });
});
