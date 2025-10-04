export const tvIntervalFrom = (tf: string) => {
  const normalized = String(tf || "").trim();
  if (!normalized) return "240";

  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  const m = {
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "3h": "180",
    "4h": "240",
    "6h": "360",
    "8h": "480",
    "12h": "720",
    "1d": "D",
    "1D": "D",
    "1day": "D",
    "1Day": "D",
    "1w": "W",
    "1W": "W",
    "1m": "M",
    "1M": "M",
  } as const;

  return m[normalized as keyof typeof m] || "240";
};

const isPlainObj = (o: any) => !!o && typeof o === "object" && o.constructor === Object;
const cleanObj = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

export type BuildTvConfigArgs = {
  symbol: string;
  timeframe: string;
  containerId: string;
  theme?: "dark" | "light";
  locale?: string;
  overrides?: Record<string, any>;
  studiesOverrides?: Record<string, any>;
};

export const buildTvConfig = ({
  symbol,
  timeframe,
  containerId,
  theme = "dark",
  locale = "en",
  overrides,
  studiesOverrides,
}: BuildTvConfigArgs) => {
  const cfg: Record<string, any> = {
    symbol: String(symbol || "BTCUSDT").toUpperCase(),
    interval: tvIntervalFrom(String(timeframe || "4h")),
    container_id: containerId,
    autosize: true,
    theme,
    locale,
  };

  if (isPlainObj(overrides) && Object.keys(overrides!).length) {
    cfg.overrides = cleanObj(overrides);
  }

  if (isPlainObj(studiesOverrides) && Object.keys(studiesOverrides!).length) {
    cfg.studies_overrides = cleanObj(studiesOverrides);
  }

  return cfg;
};
