import { setTimeout as delay } from "node:timers/promises";
import type { Request } from "express";
import { binanceService } from "../services/binanceService";
import type {
  HighPotentialCoin,
  HighPotentialFilters,
  HighPotentialResponse,
  HighPotentialSocial,
  HighPotentialTimeframe,
} from "@shared/high-potential/types";

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

interface BinanceBookTicker {
  symbol: string;
  bidPrice: string;
  askPrice: string;
}

interface BinanceExchangeSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  market_cap: number;
  market_cap_rank: number | null;
}

interface SocialCacheEntry {
  data: HighPotentialSocial;
  expiresAt: number;
  updatedAt: number;
}

interface ScanCacheEntry {
  filtersKey: string;
  data: HighPotentialResponse;
  expiresAt: number;
}

const TEN_MINUTES = 10 * 60 * 1000;
const EXCHANGE_CACHE_MS = 60 * 60 * 1000;
const MARKET_CACHE_MS = 10 * 60 * 1000;
const CRYPTOPANIC_ENDPOINT = "https://cryptopanic.com/api/v1/posts/";
const CRYPTOPANIC_SPAM_PATTERNS = [
  /airdrop\s+claim/i,
  /giveaway/i,
  /win\s*\$/i,
  /ref\s+link/i,
];

const STABLE_BASE_ASSETS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "DAI",
  "TUSD",
  "FDUSD",
  "USDP",
  "EUR",
  "GBP",
]);

const LEVERAGED_SUFFIX_PATTERNS = [
  /UP$/,
  /DOWN$/,
  /[1-5]L$/,
  /[1-5]S$/,
  /BULL$/,
  /BEAR$/,
];

const DEFAULT_FILTERS: HighPotentialFilters = {
  timeframe: "1d",
  minVolUSD: 2_000_000,
  excludeLeveraged: true,
  capRange: [0, 2_000_000_000],
};

export class InvalidHighPotentialFiltersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHighPotentialFiltersError";
  }
}

const TIMEFRAME_TO_BINANCE: Record<HighPotentialTimeframe, string> = {
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const TIMEFRAME_KLINE_LIMIT = 240;
const INTRA_VOLUME_LOOKBACK = 30;
const RESISTANCE_LOOKBACK = 20;
const RSI_PERIOD = 14;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;
const ADX_PERIOD = 14;
const EMA_FAST = 20;
const EMA_MED = 50;
const EMA_SLOW = 200;

const COINGECKO_PAGES = 2; // fetch top 500 markets
const DEBUG_EXAMPLE_LIMIT = 20;

const STATIC_ALIAS_SEEDS: Record<string, string[]> = {
  BTC: ["Bitcoin"],
  ETH: ["Ethereum"],
  BNB: ["BNB", "Binance Coin"],
  SOL: ["Solana"],
  AVAX: ["Avalanche"],
  INJ: ["Injective"],
  RNDR: ["Render", "Render Token"],
  HBAR: ["Hedera", "Hedera Hashgraph"],
  ADA: ["Cardano"],
  XRP: ["XRP", "Ripple"],
  DOGE: ["Dogecoin"],
  MATIC: ["Polygon"],
  DOT: ["Polkadot"],
  ATOM: ["Cosmos"],
  APT: ["Aptos"],
  SUI: ["Sui"],
  ARB: ["Arbitrum"],
  OP: ["Optimism"],
  NEAR: ["NEAR Protocol"],
  FTM: ["Fantom"],
  SEI: ["Sei"],
  TIA: ["Celestia"],
  MEME: ["Memecoin (MEME)"],
  PEPE: ["Pepe", "Pepe Coin"],
  WIF: ["dogwifhat", "WIF"],
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeHighPotentialFilters(
  input: Partial<HighPotentialFilters> | undefined,
): HighPotentialFilters {
  const timeframeRaw = input?.timeframe ?? DEFAULT_FILTERS.timeframe;
  if (timeframeRaw !== "1h" && timeframeRaw !== "4h" && timeframeRaw !== "1d") {
    throw new InvalidHighPotentialFiltersError("Invalid timeframe");
  }
  const timeframe: HighPotentialTimeframe = timeframeRaw;
  const minVolUSD = Math.max(0, toNumber(input?.minVolUSD, DEFAULT_FILTERS.minVolUSD));
  const excludeLeveraged = Boolean(input?.excludeLeveraged ?? DEFAULT_FILTERS.excludeLeveraged);
  const capRangeInput = Array.isArray(input?.capRange)
    ? input?.capRange
    : DEFAULT_FILTERS.capRange;
  const capMin = Math.max(0, toNumber(capRangeInput?.[0], DEFAULT_FILTERS.capRange[0]));
  const capMax = Math.max(capMin, toNumber(capRangeInput?.[1], DEFAULT_FILTERS.capRange[1]));
  return {
    timeframe,
    minVolUSD,
    excludeLeveraged,
    capRange: [capMin, capMax],
  };
}

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const cur = values[i] * k + prev * (1 - k);
    out.push(cur);
    prev = cur;
  }
  return out;
}

function rsi(values: number[], period = RSI_PERIOD): number[] {
  if (values.length <= period) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = gains.slice(0, period).reduce((sum, g) => sum + g, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, l) => sum + l, 0) / period;
  const result: number[] = [];
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function macd(values: number[], fast = MACD_FAST, slow = MACD_SLOW, signal = MACD_SIGNAL) {
  if (!values.length) {
    return { macd: [] as number[], signal: [] as number[], histogram: [] as number[] };
  }
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: number[] = [];
  const offset = fastEma.length - slowEma.length;
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }
  const signalLine = ema(macdLine, signal);
  const hist: number[] = [];
  const signalOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    hist.push(macdLine[i + signalOffset] - signalLine[i]);
  }
  return {
    macd: macdLine.slice(macdLine.length - signalLine.length),
    signal: signalLine,
    histogram: hist,
  };
}

function adx(highs: number[], lows: number[], closes: number[], period = ADX_PERIOD) {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    return { adx: [] as number[], plusDI: [] as number[], minusDI: [] as number[] };
  }
  if (highs.length < period + 1) {
    return { adx: [], plusDI: [], minusDI: [] };
  }
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const trueRange = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    tr.push(trueRange);
    const upMove = high - highs[i - 1];
    const downMove = lows[i - 1] - low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  const smooth = (arr: number[]) => {
    const result: number[] = [];
    let sum = arr.slice(0, period).reduce((acc, cur) => acc + cur, 0);
    result.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      result.push(sum);
    }
    return result;
  };
  const trSmooth = smooth(tr);
  const plusSmooth = smooth(plusDM);
  const minusSmooth = smooth(minusDM);
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];
  for (let i = 0; i < trSmooth.length; i++) {
    const trVal = trSmooth[i];
    const p = trVal === 0 ? 0 : (plusSmooth[i] / trVal) * 100;
    const m = trVal === 0 ? 0 : (minusSmooth[i] / trVal) * 100;
    plusDI.push(p);
    minusDI.push(m);
    const denom = p + m;
    dx.push(denom === 0 ? 0 : (Math.abs(p - m) / denom) * 100);
  }
  const adxValues: number[] = [];
  let adxAvg = dx.slice(0, period).reduce((acc, cur) => acc + cur, 0) / period;
  adxValues.push(adxAvg);
  for (let i = period; i < dx.length; i++) {
    adxAvg = (adxAvg * (period - 1) + dx[i]) / period;
    adxValues.push(adxAvg);
  }
  return {
    adx: adxValues,
    plusDI: plusDI.slice(plusDI.length - adxValues.length),
    minusDI: minusDI.slice(minusDI.length - adxValues.length),
  };
}

function highest(values: number[], lookback: number): number {
  if (!values.length) return 0;
  const slice = values.slice(-lookback);
  return slice.reduce((max, cur) => (cur > max ? cur : max), slice[0] ?? 0);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, cur) => acc + cur, 0);
  return sum / values.length;
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function computeConfidence(score: number): "High" | "Medium" | "Watch" | "Low" {
  if (score >= 75) return "High";
  if (score >= 60) return "Medium";
  if (score >= 50) return "Watch";
  return "Low";
}
interface CoinComputationContext {
  rsiValue: number;
  rsiRising: boolean;
  volumeRatio: number;
  intraVolumeRatio: number;
  macdHistogram: number;
  macdCrossBullishRecent: boolean;
  adxValue: number;
  plusDI: number;
  minusDI: number;
  ema20: number;
  ema50: number;
  ema200: number;
  emaCrossRecent: boolean;
  price: number;
  distancePct: number;
  vol24h: number;
  spreadPct: number;
  marketCap: number;
  social: HighPotentialSocial;
  headlineDelta: number;
}

function scoreMomentum(ctx: CoinComputationContext): number {
  let rsiScore = 0;
  if (ctx.rsiRising) {
    if (ctx.rsiValue >= 35 && ctx.rsiValue <= 45) rsiScore = 10;
    else if (ctx.rsiValue > 45 && ctx.rsiValue <= 55) rsiScore = 8;
    else if (ctx.rsiValue > 55 && ctx.rsiValue <= 65) rsiScore = 6;
  }

  const macdScore = (ctx.macdCrossBullishRecent ? 8 : 0) + (ctx.macdHistogram > 0 ? 4 : 0);

  let adxScore = 0;
  if (ctx.plusDI > ctx.minusDI) {
    if (ctx.adxValue >= 18 && ctx.adxValue <= 35) adxScore = 8;
    else if (ctx.adxValue >= 14 && ctx.adxValue < 18) adxScore = 4;
  }

  return rsiScore + macdScore + adxScore;
}

function scoreVolume(ctx: CoinComputationContext): number {
  const { volumeRatio, intraVolumeRatio } = ctx;
  let dayRatioScore = 0;
  if (volumeRatio >= 3) dayRatioScore = 15;
  else if (volumeRatio >= 2) dayRatioScore = 10;
  else if (volumeRatio >= 1.5) dayRatioScore = 6;

  let intraScore = 0;
  if (intraVolumeRatio >= 2.5) intraScore = 10;
  else if (intraVolumeRatio >= 1.8) intraScore = 7;
  else if (intraVolumeRatio >= 1.3) intraScore = 4;

  return dayRatioScore + intraScore;
}

function scoreBreakout(ctx: CoinComputationContext): number {
  const { distancePct, price, ema20, ema50 } = ctx;
  let distanceScore = 0;
  if (distancePct <= 0) distanceScore = 12;
  else if (distancePct <= 1) distanceScore = 10;
  else if (distancePct <= 2.5) distanceScore = 7;
  else if (distancePct <= 4) distanceScore = 3;

  let emaScore = 0;
  if (price >= ema20 && ema20 >= ema50) emaScore += 5;
  if (ctx.emaCrossRecent) emaScore += 3;
  if (emaScore > 8) emaScore = 8;

  return distanceScore + emaScore;
}

function scoreMarketCap(marketCap: number): number {
  if (marketCap < 100_000_000) return 10;
  if (marketCap < 500_000_000) return 7;
  if (marketCap < 2_000_000_000) return 4;
  return 0;
}

function scoreSocial(ctx: CoinComputationContext): number {
  const { social, headlineDelta } = ctx;
  let balanceScore = 0;
  if (headlineDelta >= 3) balanceScore = 6;
  else if (headlineDelta >= 1) balanceScore = 4;
  else if (headlineDelta === 0) balanceScore = 2;

  let engagementScore = 0;
  if (social.avgVoteDelta >= 5) engagementScore = 4;
  else if (social.avgVoteDelta >= 2) engagementScore = 2;
  else if (social.avgVoteDelta >= 0) engagementScore = 1;

  return balanceScore + engagementScore;
}

function scoreQuality(ctx: CoinComputationContext): number {
  let score = 0;
  if (ctx.vol24h >= 2_000_000) score += 2;
  if (ctx.spreadPct <= 0.15) score += 1;
  score += 2; // clean pair (leveraged/stable excluded during filtering)
  return score;
}

function assignBucket(ctx: CoinComputationContext): HighPotentialCoin["bucket"] {
  const { rsiValue, rsiRising, volumeRatio, macdHistogram, adxValue, distancePct } = ctx;
  if (distancePct <= 2.5 && volumeRatio >= 1.5) return "Breakout Zone";
  if (rsiValue >= 30 && rsiValue <= 45 && rsiRising && volumeRatio >= 1.3) return "Oversold Recovery";
  if (rsiValue >= 50 && rsiValue <= 65 && rsiRising && macdHistogram > 0 && adxValue >= 18) {
    return "Strong Momentum";
  }
  return null;
}

function calcSpreadPct(ticker: BinanceBookTicker | null): number {
  if (!ticker) return Infinity;
  const bid = toNumber(ticker.bidPrice);
  const ask = toNumber(ticker.askPrice);
  if (!bid || !ask) return Infinity;
  return ((ask - bid) / ask) * 100;
}

function coinKey(filters: HighPotentialFilters): string {
  return JSON.stringify(filters);
}

type AliasBundle = {
  query: string;
  aliases: string[];
};

function buildAliasBundle(symbol: string, name?: string | null): AliasBundle {
  const base = symbol.toUpperCase();
  const aliases = new Set<string>();
  aliases.add(base);
  if (name) {
    aliases.add(name);
    aliases.add(name.replace(/[^a-zA-Z0-9]+/g, " "));
  }
  const staticAliases = STATIC_ALIAS_SEEDS[base];
  if (staticAliases) {
    for (const alias of staticAliases) aliases.add(alias);
  }
  if (/^[a-z]+$/i.test(base) && base.length <= 4) {
    aliases.add(`${base} crypto`);
  }
  const normalizedAliases = Array.from(aliases).map((alias) => alias.trim()).filter(Boolean);
  const searchTerms = normalizedAliases.map((alias) => `"${alias.toLowerCase()}"`).join(" OR ");
  const query = `(${searchTerms}) AND (crypto OR token OR coin)`;
  return { query, aliases: normalizedAliases };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return (await res.json()) as T;
}

export class HighPotentialScanner {
  private exchangeCache: { data: BinanceExchangeSymbol[]; expiresAt: number } | null = null;
  private tickerCache: { data: BinanceTicker24h[]; fetchedAt: number } | null = null;
  private bookTickerCache: Map<string, { data: BinanceBookTicker; fetchedAt: number }> = new Map();
  private marketCache: { data: CoinGeckoMarketItem[]; expiresAt: number } | null = null;
  private socialCache: Map<string, SocialCacheEntry> = new Map();
  private scanCache: Map<string, ScanCacheEntry> = new Map();
  private throttling = Promise.resolve();

  formatFiltersFromRequest(req: Request): HighPotentialFilters {
    const query = (req.query ?? {}) as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(query, "timeframe")) {
      throw new InvalidHighPotentialFiltersError(
        "The `timeframe` query parameter is no longer supported. Use `tf` instead.",
      );
    }

    const normalizeParam = (value: unknown): unknown => {
      if (Array.isArray(value)) return value[0];
      return value;
    };

    const timeframeRaw = Object.prototype.hasOwnProperty.call(query, "tf")
      ? normalizeParam(query.tf)
      : undefined;
    const minVolUSD = normalizeParam(query.minVolUSD);
    const capMin = normalizeParam(query.capMin);
    const capMax = normalizeParam(query.capMax);
    const excludeLeveraged = normalizeParam(query.excludeLeveraged);

    const capRange: [number, number] | undefined =
      capMin !== undefined || capMax !== undefined
        ? [toNumber(capMin, DEFAULT_FILTERS.capRange[0]), toNumber(capMax, DEFAULT_FILTERS.capRange[1])]
        : undefined;
    return normalizeHighPotentialFilters({
      timeframe:
        timeframeRaw !== undefined
          ? (String(timeframeRaw) as HighPotentialTimeframe | undefined)
          : undefined,
      minVolUSD: minVolUSD !== undefined ? toNumber(minVolUSD, DEFAULT_FILTERS.minVolUSD) : undefined,
      excludeLeveraged: excludeLeveraged !== undefined ? excludeLeveraged !== "false" : undefined,
      capRange,
    });
  }

  async getScan(
    filters: HighPotentialFilters,
    options: { debug?: boolean } = {},
  ): Promise<HighPotentialResponse> {
    const key = coinKey(filters);
    const now = Date.now();
    const cached = this.scanCache.get(key);
    const debugRequested = Boolean(options.debug);
    if (!debugRequested && cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const data = await this.performScan(filters, debugRequested);
      if (debugRequested) {
        const { debug, ...rest } = data;
        this.scanCache.set(key, {
          filtersKey: key,
          data: rest,
          expiresAt: now + TEN_MINUTES,
        });
      } else {
        this.scanCache.set(key, { filtersKey: key, data, expiresAt: now + TEN_MINUTES });
      }
      return data;
    } catch (error) {
      if (cached) {
        cached.data.dataStale = true;
        return cached.data;
      }
      throw error;
    }
  }

  private async performScan(
    filters: HighPotentialFilters,
    includeDebug: boolean,
  ): Promise<HighPotentialResponse> {
    const exchangeSymbols = await this.getExchangeSymbols();
    const tickers = await this.getTicker24h();
    const tickerMap = new Map(tickers.map((t) => [t.symbol, t] as const));

    const universe = exchangeSymbols.filter((symbol) => {
      if (symbol.quoteAsset !== "USDT") return false;
      if (symbol.status !== "TRADING") return false;
      const base = symbol.baseAsset.toUpperCase();
      if (STABLE_BASE_ASSETS.has(base)) return false;
      return true;
    });

    const excludedExamples: Array<{ symbol: string; reason: string }> = [];
    const collectExample = (symbol: string, reason: string) => {
      if (!includeDebug) return;
      if (excludedExamples.length >= DEBUG_EXAMPLE_LIMIT) return;
      excludedExamples.push({ symbol, reason });
    };

    const leveragedFiltered = universe.filter((symbol) => {
      if (!filters.excludeLeveraged) return true;
      const baseFromSymbol = symbol.symbol.toUpperCase().replace(/USDT$/, "");
      const baseAsset = (symbol.baseAsset || baseFromSymbol).toUpperCase();
      const baseToCheck = baseFromSymbol.length > 0 ? baseFromSymbol : baseAsset;
      const isLeveraged = LEVERAGED_SUFFIX_PATTERNS.some((pattern) => pattern.test(baseToCheck));
      if (isLeveraged) {
        collectExample(symbol.symbol, "leveraged-suffix");
        return false;
      }
      return true;
    });

    const volumeCandidates: Array<{
      symbol: BinanceExchangeSymbol;
      ticker: BinanceTicker24h;
      volume: number;
    }> = [];

    for (const symbol of leveragedFiltered) {
      const ticker = tickerMap.get(symbol.symbol);
      if (!ticker) continue;
      const vol = toNumber(ticker.quoteVolume);
      if (!Number.isFinite(vol)) continue;
      if (vol < filters.minVolUSD) {
        collectExample(symbol.symbol, "below-min-volume");
        continue;
      }
      volumeCandidates.push({ symbol, ticker, volume: vol });
    }

    volumeCandidates.sort((a, b) => b.volume - a.volume);
    const filtered = volumeCandidates.slice(0, 60);

    const marketMap = await this.getMarketMap();
    const timeframe = filters.timeframe;
    const binanceInterval = TIMEFRAME_TO_BINANCE[timeframe];

    const coins: HighPotentialCoin[] = [];
    let dataStale = false;
    let analysedCount = 0;
    let knownMarketCaps = 0;
    let missingMarketCaps = 0;

    for (const entry of filtered) {
      try {
        const analysed = await this.analyseCoin(entry.symbol, entry.ticker, marketMap, binanceInterval, timeframe);
        if (!analysed) continue;
        analysedCount++;
        if (analysed.marketCapKnown) knownMarketCaps++;
        else missingMarketCaps++;
        const withinCapRange = !analysed.marketCapKnown
          || (analysed.marketCap >= filters.capRange[0] && analysed.marketCap <= filters.capRange[1]);
        if (!withinCapRange) {
          collectExample(entry.symbol.symbol, "cap-out-of-range");
          continue;
        }
        coins.push(analysed.coin);
        if (analysed.socialStale) {
          dataStale = true;
        }
      } catch (error) {
        console.error("Failed to analyse", entry.symbol.symbol, error);
        dataStale = true;
      }
      await delay(120);
    }

    coins.sort((a, b) => b.score - a.score);
    const top = coins.slice(0, 10);

    const buckets = {
      breakoutZone: coins.filter((coin) => coin.bucket === "Breakout Zone"),
      oversoldRecovery: coins.filter((coin) => coin.bucket === "Oversold Recovery"),
      strongMomentum: coins.filter((coin) => coin.bucket === "Strong Momentum"),
    };

    const response: HighPotentialResponse = {
      dataStale,
      timeframe,
      filters,
      top,
      buckets,
    };

    if (includeDebug) {
      response.debug = {
        universe: universe.length,
        afterLeveraged: leveragedFiltered.length,
        afterMinVolume: volumeCandidates.length,
        withMarketCap: { known: knownMarketCaps, missing: missingMarketCaps },
        afterCapRange: coins.length,
        afterIndicators: analysedCount,
        topCount: top.length,
        bucketCounts: {
          breakout: buckets.breakoutZone.length,
          recovery: buckets.oversoldRecovery.length,
          momentum: buckets.strongMomentum.length,
        },
        examples: {
          excluded: excludedExamples,
        },
      };
    }

    return response;
  }
  private async analyseCoin(
    symbol: BinanceExchangeSymbol,
    ticker: BinanceTicker24h,
    marketMap: Map<string, CoinGeckoMarketItem>,
    interval: string,
    timeframe: HighPotentialTimeframe,
  ): Promise<
    { coin: HighPotentialCoin; marketCap: number; marketCapKnown: boolean; socialStale: boolean } | null
  > {
    const base = symbol.baseAsset.toUpperCase();
    const market = marketMap.get(base.toLowerCase()) ?? marketMap.get(base.toUpperCase()) ?? null;

    const price = toNumber(ticker.lastPrice);
    const change24hPct = toNumber(ticker.priceChangePercent);
    const vol24h = toNumber(ticker.quoteVolume);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(vol24h) || vol24h <= 0) return null;

    const marketCapRaw = market?.market_cap;
    const marketCapKnown = Number.isFinite(marketCapRaw) && (marketCapRaw ?? 0) > 0;
    const marketCap = marketCapKnown ? Number(marketCapRaw) : 0;

    const klines = await binanceService.getKlineData(symbol.symbol, interval, TIMEFRAME_KLINE_LIMIT);
    const closes = klines.map((k) => toNumber(k.close));
    const highs = klines.map((k) => toNumber(k.high));
    const lows = klines.map((k) => toNumber(k.low));
    const volumes = klines.map((k) => toNumber(k.quoteVolume ?? k.volume));

    const rsiSeries = rsi(closes);
    const latestRsi = rsiSeries.at(-1);
    const prevRsi = rsiSeries.at(-4);
    const rsiValue = Number.isFinite(latestRsi) ? Number(latestRsi) : 0;
    const rsiRising = Number.isFinite(latestRsi) && Number.isFinite(prevRsi)
      ? Number(latestRsi) > Number(prevRsi)
      : false;

    const macdData = macd(closes);
    const macdHistogramRaw = macdData.histogram.at(-1);
    const macdHistogram = Number.isFinite(macdHistogramRaw) ? Number(macdHistogramRaw) : 0;
    let macdCrossBullishRecent = false;
    const macdLen = Math.min(macdData.macd.length, macdData.signal.length);
    for (let i = Math.max(1, macdLen - 5); i < macdLen; i++) {
      const prevDiff = macdData.macd[i - 1] - macdData.signal[i - 1];
      const currDiff = macdData.macd[i] - macdData.signal[i];
      if (prevDiff <= 0 && currDiff > 0) {
        macdCrossBullishRecent = true;
        break;
      }
    }

    const adxData = adx(highs, lows, closes);
    const adxValue = adxData.adx.at(-1) ?? 0;
    const plusDI = adxData.plusDI.at(-1) ?? 0;
    const minusDI = adxData.minusDI.at(-1) ?? 0;

    const ema20Series = ema(closes, EMA_FAST);
    const ema50Series = ema(closes, EMA_MED);
    const ema200Series = ema(closes, EMA_SLOW);
    const ema20 = ema20Series.at(-1) ?? 0;
    const ema50 = ema50Series.at(-1) ?? 0;
    const ema200 = ema200Series.at(-1) ?? 0;
    let emaCrossRecent = false;
    for (let i = Math.max(1, closes.length - 10); i < closes.length; i++) {
      const prevDiff = (ema20Series[i - 1] ?? 0) - (ema50Series[i - 1] ?? 0);
      const currDiff = (ema20Series[i] ?? 0) - (ema50Series[i] ?? 0);
      if (prevDiff <= 0 && currDiff > 0) {
        emaCrossRecent = true;
        break;
      }
    }

    const resistance20 = highest(closes, RESISTANCE_LOOKBACK);
    const breakoutDistancePct = resistance20 > 0 ? ((resistance20 - price) / resistance20) * 100 : 0;

    const lastVolume = volumes.at(-1) ?? 0;
    const averageVolume = average(volumes.slice(-INTRA_VOLUME_LOOKBACK));
    const intraTFVolRatio = averageVolume > 0 ? lastVolume / averageVolume : 0;

    const daily = await binanceService.getKlineData(symbol.symbol, "1d", 30);
    const last7 = daily.slice(-7);
    const last7QuoteVolumes = last7.map((k) => toNumber(k.quoteVolume ?? k.volume));
    const sparkline = last7.map((k) => toNumber(k.close));
    let vol7dAvg = 0;
    if (last7QuoteVolumes.length >= 7) {
      vol7dAvg = average(last7QuoteVolumes);
    } else {
      const total = last7QuoteVolumes.reduce((sum, value) => sum + value, 0);
      const missingDays = Math.max(0, 7 - last7QuoteVolumes.length);
      const adjustedTotal = total + missingDays * vol24h;
      vol7dAvg = adjustedTotal / (missingDays > 0 ? 7 : Math.max(1, last7QuoteVolumes.length));
    }
    if (!Number.isFinite(vol7dAvg) || vol7dAvg <= 0) {
      vol7dAvg = vol24h;
    }
    const volumeRatio = vol7dAvg > 0 ? vol24h / vol7dAvg : 0;

    const bookTicker = await this.getBookTicker(symbol.symbol);
    const spreadPct = calcSpreadPct(bookTicker);

    const socialResult = await this.getSocialData(symbol.baseAsset, market?.name ?? symbol.baseAsset, timeframe);

    const context: CoinComputationContext = {
      rsiValue,
      rsiRising,
      volumeRatio,
      intraVolumeRatio: intraTFVolRatio,
      macdHistogram,
      macdCrossBullishRecent,
      adxValue,
      plusDI,
      minusDI,
      ema20,
      ema50,
      ema200,
      emaCrossRecent,
      price,
      distancePct: breakoutDistancePct,
      vol24h,
      spreadPct,
      marketCap,
      social: socialResult.data,
      headlineDelta: socialResult.data.pos - socialResult.data.neg,
    };

    const momentum = scoreMomentum(context);
    const volume = scoreVolume(context);
    const breakout = scoreBreakout(context);
    const marketCapScore = marketCapKnown ? scoreMarketCap(marketCap) : 0;
    const socialScore = scoreSocial(context);
    const quality = scoreQuality(context);

    let totalScore = momentum + volume + breakout + marketCapScore + socialScore + quality;
    if (!Number.isFinite(totalScore)) totalScore = 0;
    totalScore = Math.max(0, Math.min(100, totalScore));

    const coin: HighPotentialCoin = {
      symbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      name: market?.name || symbol.baseAsset,
      price,
      change24hPct,
      vol24h,
      vol7dAvg,
      intraTFVolRatio: intraTFVolRatio,
      rsi: rsiValue,
      macd: { crossBullishRecent: macdCrossBullishRecent, histogram: macdHistogram },
      adx: { adx: adxValue, plusDI, minusDI },
      ema: { ema20, ema50, ema200 },
      resistance20,
      breakoutDistancePct,
      marketCap,
      marketCapRank: market?.market_cap_rank ?? null,
      social: socialResult.data,
      score: Math.round(totalScore),
      confidence: computeConfidence(totalScore),
      bucket: null,
      sparkline,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    coin.bucket = assignBucket(context);

    return { coin, marketCap, marketCapKnown, socialStale: socialResult.stale };
  }

  private async getExchangeSymbols(): Promise<BinanceExchangeSymbol[]> {
    const now = Date.now();
    if (this.exchangeCache && this.exchangeCache.expiresAt > now) {
      return this.exchangeCache.data;
    }
    const info = await binanceService.getExchangeInfo();
    const symbols: BinanceExchangeSymbol[] = Array.isArray(info.symbols)
      ? info.symbols.map((s: any) => ({
          symbol: String(s.symbol),
          baseAsset: String(s.baseAsset),
          quoteAsset: String(s.quoteAsset),
          status: String(s.status),
        }))
      : [];
    this.exchangeCache = { data: symbols, expiresAt: now + EXCHANGE_CACHE_MS };
    return symbols;
  }

  private async getTicker24h(): Promise<BinanceTicker24h[]> {
    const now = Date.now();
    if (this.tickerCache && now - this.tickerCache.fetchedAt < 60_000) {
      return this.tickerCache.data;
    }
    const data = await fetchJson<BinanceTicker24h[]>("https://api.binance.com/api/v3/ticker/24hr");
    this.tickerCache = { data, fetchedAt: now };
    return data;
  }

  private async getBookTicker(symbol: string): Promise<BinanceBookTicker | null> {
    const cached = this.bookTickerCache.get(symbol);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < 30_000) {
      return cached.data;
    }
    try {
      const data = await fetchJson<BinanceBookTicker>(
        `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`,
      );
      this.bookTickerCache.set(symbol, { data, fetchedAt: now });
      return data;
    } catch (error) {
      console.warn("Failed to fetch book ticker", symbol, error);
      return null;
    }
  }

  private async getMarketList(): Promise<CoinGeckoMarketItem[]> {
    const now = Date.now();
    if (this.marketCache && this.marketCache.expiresAt > now) {
      return this.marketCache.data;
    }
    const results: CoinGeckoMarketItem[] = [];
    for (let page = 1; page <= COINGECKO_PAGES; page++) {
      const url =
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&price_change_percentage=24h`;
      const pageData = await fetchJson<CoinGeckoMarketItem[]>(url);
      results.push(
        ...pageData.map((item) => ({
          id: item.id,
          symbol: item.symbol,
          name: item.name,
          market_cap: item.market_cap,
          market_cap_rank: item.market_cap_rank ?? null,
        })),
      );
      await delay(250);
    }
    this.marketCache = { data: results, expiresAt: now + MARKET_CACHE_MS };
    return results;
  }

  private async getMarketMap(): Promise<Map<string, CoinGeckoMarketItem>> {
    const list = await this.getMarketList();
    const map = new Map<string, CoinGeckoMarketItem>();
    for (const item of list) {
      const symbol = (item.symbol || "").toUpperCase();
      if (!symbol) continue;
      const existing = map.get(symbol);
      if (!existing || (existing.market_cap ?? 0) < (item.market_cap ?? 0)) {
        map.set(symbol, item);
      }
    }
    return map;
  }

  private async getSocialData(
    symbol: string,
    name: string,
    timeframe: HighPotentialTimeframe,
  ): Promise<{ data: HighPotentialSocial; stale: boolean }> {
    const key = `${symbol.toUpperCase()}-${timeframe}`;
    const now = Date.now();
    const cached = this.socialCache.get(key);
    if (cached && cached.expiresAt > now) {
      return { data: cached.data, stale: false };
    }

    const token = process.env.CRYPTOPANIC_TOKEN || process.env.CRYPTOPANIC_KEY;
    if (!token) {
      return { data: { pos: 0, neg: 0, neu: 0, avgVoteDelta: 0 }, stale: true };
    }

    try {
      await this.throttleCryptoPanic();
      const bundle = buildAliasBundle(symbol, name);
      const params = new URLSearchParams();
      params.set("auth_token", token);
      params.set("public", "true");
      params.set("kind", "news");
      params.set("filter", "all");
      params.set("q", bundle.query);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      params.set("since", since);
      const url = `${CRYPTOPANIC_ENDPOINT}?${params.toString()}`;
      const payload = await fetchJson<{ results?: any[] }>(url);
      const posts = Array.isArray(payload.results) ? payload.results : [];

      const keepSince = Date.now() - 24 * 60 * 60 * 1000;
      const seen = new Set<string>();
      let pos = 0;
      let neg = 0;
      let neu = 0;
      let voteDeltaSum = 0;
      let voteDeltaCount = 0;

      for (const post of posts) {
        const publishedAt = new Date(post.published_at ?? post.date ?? 0).getTime();
        if (Number.isFinite(publishedAt) && publishedAt < keepSince) continue;
        const title = String(post.title ?? "");
        const description = String(post.description ?? post.summary ?? "");
        const combined = `${title} ${description}`.toLowerCase();
        if (!bundle.aliases.some((alias) => combined.includes(alias.toLowerCase()))) continue;
        if (CRYPTOPANIC_SPAM_PATTERNS.some((pattern) => pattern.test(combined))) continue;
        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const normalizedUrl = String(post.url ?? post.source?.url ?? normalizedTitle);
        const dedupeKey = normalizedUrl || normalizedTitle;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const sentiment = String(post.sentiment || post.metadata?.sentiment || "neutral").toLowerCase();
        const votes = post.votes ?? {};
        const up = toNumber(votes.up ?? votes.positive ?? votes.like ?? votes.vote_up ?? 0);
        const down = toNumber(votes.down ?? votes.negative ?? votes.dislike ?? votes.vote_down ?? 0);
        const voteDelta = up - down;

        if (sentiment === "positive") {
          pos++;
          voteDeltaSum += voteDelta;
          voteDeltaCount++;
        } else if (sentiment === "negative") {
          neg++;
        } else {
          neu++;
        }
      }

      const data: HighPotentialSocial = {
        pos,
        neg,
        neu,
        avgVoteDelta: voteDeltaCount > 0 ? voteDeltaSum / voteDeltaCount : 0,
      };

      this.socialCache.set(key, { data, expiresAt: now + TEN_MINUTES, updatedAt: now });
      return { data, stale: false };
    } catch (error) {
      console.warn("CryptoPanic request failed", symbol, error);
      return { data: { pos: 0, neg: 0, neu: 0, avgVoteDelta: 0 }, stale: true };
    }
  }

  private throttleCryptoPanic(): Promise<void> {
    this.throttling = this.throttling.then(() => delay(2000));
    return this.throttling;
  }
}

export const highPotentialScanner = new HighPotentialScanner();
