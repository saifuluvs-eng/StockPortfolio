import type { ScanResult } from "@shared/types/scanner";

export type ExtractableScanResult = { symbol?: unknown };

export function extractScanResult<T extends ExtractableScanResult = ScanResult>(
  payload: unknown,
): T | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const withData = payload as { data?: unknown };

  if (Array.isArray(withData.data)) {
    const [first] = withData.data as unknown[];
    return first && typeof first === "object" ? (first as T) : null;
  }

  if (withData.data && typeof withData.data === "object") {
    return extractScanResult<T>(withData.data);
  }

  if ((payload as ExtractableScanResult)?.symbol) {
    return payload as T;
  }

  return null;
}
