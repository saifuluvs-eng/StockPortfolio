import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { highPotentialScanner, InvalidHighPotentialFiltersError } from "./scanner";

test("formatFiltersFromRequest uses the tf query parameter when present", () => {
  const req = { query: { tf: "4h" } } as unknown as Request;
  const filters = highPotentialScanner.formatFiltersFromRequest(req);
  assert.equal(filters.timeframe, "4h");
});

test("formatFiltersFromRequest rejects the legacy timeframe query parameter", () => {
  const req = { query: { timeframe: "4h" } } as unknown as Request;
  assert.throws(
    () => highPotentialScanner.formatFiltersFromRequest(req),
    InvalidHighPotentialFiltersError,
  );
});
