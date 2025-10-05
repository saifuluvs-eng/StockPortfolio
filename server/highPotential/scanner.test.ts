import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { highPotentialScanner, InvalidHighPotentialFiltersError } from "./scanner";

test("formatFiltersFromRequest uses the tf query parameter when present", () => {
  const req = { query: { tf: "4h" } } as unknown as Request;
  const filters = highPotentialScanner.formatFiltersFromRequest(req);
  assert.equal(filters.timeframe, "4h");
});

test("formatFiltersFromRequest defaults timeframe to 1d when not provided", () => {
  const req = { query: {} } as unknown as Request;
  const filters = highPotentialScanner.formatFiltersFromRequest(req);
  assert.equal(filters.timeframe, "1d");
});

test("formatFiltersFromRequest rejects the legacy timeframe query parameter", () => {
  const req = { query: { timeframe: "4h" } } as unknown as Request;
  assert.throws(
    () => highPotentialScanner.formatFiltersFromRequest(req),
    InvalidHighPotentialFiltersError,
  );
});

test("formatFiltersFromRequest rejects invalid timeframe values", () => {
  const req = { query: { tf: "12h" } } as unknown as Request;
  assert.throws(
    () => highPotentialScanner.formatFiltersFromRequest(req),
    (error: unknown) => {
      assert.ok(error instanceof InvalidHighPotentialFiltersError);
      assert.equal(error.message, "Invalid timeframe");
      return true;
    },
  );
});
