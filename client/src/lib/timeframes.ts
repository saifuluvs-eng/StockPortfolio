export const DEFAULT_TIMEFRAME = "240"; // 4h

export const SCANNER_TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m", backend: "15m" },
  { value: "60", label: "1hr", display: "1h", backend: "1h" },
  { value: "240", label: "4hr", display: "4h", backend: "4h" },
  { value: "D", label: "1Day", display: "1D", backend: "1d" },
  { value: "W", label: "1Week", display: "1W", backend: "1w" },
] as const;

export type ScannerTimeframeValue = (typeof SCANNER_TIMEFRAMES)[number]["value"];

export function toFrontendTimeframe(
  value: string | undefined | null,
  fallback: ScannerTimeframeValue = DEFAULT_TIMEFRAME,
): ScannerTimeframeValue {
  if (!value) return fallback;
  const match = SCANNER_TIMEFRAMES.find(
    (tf) => tf.value === value || tf.backend === value,
  );
  return (match?.value ?? fallback) as ScannerTimeframeValue;
}

export function toBackendTimeframe(
  value: string | undefined | null,
  fallback: string = "4h",
): string {
  if (!value) return fallback;
  const match = SCANNER_TIMEFRAMES.find((tf) => tf.value === value);
  return match?.backend ?? fallback;
}

export function getTimeframeDisplay(value: string): string {
  const match = SCANNER_TIMEFRAMES.find((tf) => tf.value === value);
  return match?.display ?? value;
}
