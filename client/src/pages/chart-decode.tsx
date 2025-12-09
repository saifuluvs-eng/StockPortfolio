import React, { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Page } from "@/components/layout/Layout";
import { Card, CardContent, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Search, Brain, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import LightweightChart, { ChartRef } from "@/components/charts/LightweightChart";
import ReactMarkdown from "react-markdown";

export default function ChartDecodePage() {
    const [match, params] = useRoute("/chart-decode/:symbol?");
    const [location, setLocation] = useLocation();
    const { toast } = useToast();

    // Default symbol or from URL
    const initialSymbol = (params?.symbol || "BTCUSDT").toUpperCase();
    const [symbolInput, setSymbolInput] = useState(initialSymbol);
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const [timeframe, setTimeframe] = useState("4h");
    const [chartData, setChartData] = useState<any[]>([]);

    // AI State
    const [isDecoding, setIsDecoding] = useState(false);
    const [decodeResult, setDecodeResult] = useState<string | null>(null);

    const chartRef = useRef<ChartRef>(null);

    // Sync URL with selection
    useEffect(() => {
        if (selectedSymbol && selectedSymbol !== params?.symbol) {
            setLocation(`/chart-decode/${selectedSymbol}`);
        }
    }, [selectedSymbol, setLocation, params?.symbol]);

    // Fetch Candle Data
    useEffect(() => {
        const fetchCandles = async () => {
            try {
                const s = selectedSymbol.endsWith("USDT") ? selectedSymbol : `${selectedSymbol}USDT`;
                const url = `/api/ohlcv?symbol=${s}&tf=${timeframe}`;
                console.log("Fetching candles from:", url);

                const res = await api(url);
                console.log("Response status:", res.status);

                if (res.ok) {
                    const json = await res.json();
                    // Handle both Vercel API ({ data: [...] }) and Express API ({ candles: [...] })
                    const rawData = json.candles || json.data || [];
                    console.log("Items received:", rawData.length);

                    if (rawData.length === 0) {
                        console.warn("No data in response", json);
                        toast.error(`No chart data found for ${s}`);
                        setChartData([]);
                        return;
                    }

                    // Map data to lightweight-charts format
                    const mappedData = rawData.map((k: any) => {
                        // Vercel API returns objects: { time, open, high, low, close }
                        if (k.time && k.open) {
                            return {
                                time: k.time / 1000, // Vercel API sends ms, LWC needs seconds
                                open: Number(k.open),
                                high: Number(k.high),
                                low: Number(k.low),
                                close: Number(k.close),
                            };
                        }
                        // Express/Binance raw returns arrays: [time, open, high, low, close, volume, ...]
                        // OR Express API returns { openTime, open, ... } objects (as seen in server/routes/ohlcv.ts)
                        // server/routes/ohlcv.ts returns objects with openTime.
                        if (k.openTime) {
                            return {
                                time: k.openTime / 1000,
                                open: Number(k.open),
                                high: Number(k.high),
                                low: Number(k.low),
                                close: Number(k.close),
                            };
                        }
                        // Fallback for raw arrays if any
                        return {
                            time: k[0] / 1000,
                            open: Number(k[1]),
                            high: Number(k[2]),
                            low: Number(k[3]),
                            close: Number(k[4]),
                        };
                    });

                    // Sort just in case
                    mappedData.sort((a: any, b: any) => a.time - b.time);

                    console.log("Mapped data length:", mappedData.length);
                    setChartData(mappedData);
                    setDecodeResult(null);
                } else {
                    console.error("API Error", res.status);
                    toast.error("Failed to fetch chart data");
                    setChartData([]);
                }
            } catch (e) {
                console.error("Failed to fetch klines:", e);
                toast.error("Error loading chart");
                setChartData([]);
            }
        };

        if (selectedSymbol) {
            fetchCandles();
        }
    }, [selectedSymbol, timeframe]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (symbolInput) {
            const upper = symbolInput.toUpperCase();
            setSelectedSymbol(upper);
        }
    };

    const handleDecode = async () => {
        if (!chartRef.current) return;

        setIsDecoding(true);
        try {
            const screenshot = chartRef.current.takeScreenshot();
            if (!screenshot) throw new Error("Failed to capture chart");

            const res = await api("/api/decode-chart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: screenshot })
            });

            if (!res.ok) throw new Error("Decode failed");

            const json = await res.json();
            setDecodeResult(json.data);
            toast.success("Chart decoded successfully!");
        } catch (error) {
            console.error("Decode error:", error);
            toast.error("Failed to decode chart. AI might be busy.");
        } finally {
            setIsDecoding(false);
        }
    };

    return (
        <Page>
            <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
                {/* Top Bar: Search & Controls */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md min-w-[300px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Enter symbol (e.g. BTC)"
                                value={symbolInput}
                                onChange={(e) => setSymbolInput(e.target.value)}
                                className="pl-9 bg-card/50"
                            />
                        </div>
                        <Select value={timeframe} onValueChange={setTimeframe}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15m">15m</SelectItem>
                                <SelectItem value="1h">1h</SelectItem>
                                <SelectItem value="4h">4h</SelectItem>
                                <SelectItem value="1d">1D</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit" variant="secondary">
                            Load
                        </Button>
                    </form>

                    <Button
                        size="lg"
                        onClick={handleDecode}
                        disabled={isDecoding || chartData.length === 0}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] animate-pulse hover:animate-none"
                    >
                        {isDecoding ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Decoding...
                            </>
                        ) : (
                            <>
                                <Brain className="mr-2 h-5 w-5" />
                                Decode Chart
                            </>
                        )}
                    </Button>
                </div>

                {/* Main Split View - Fixed Layout */}
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

                    {/* Left/Top: Chart Container - Takes 2/3 space */}
                    <Card className="flex-[2] min-h-[500px] lg:min-h-0 overflow-hidden border-border bg-card/40 backdrop-blur-sm">
                        <CardContent className="p-0 h-full relative">
                            {chartData.length > 0 ? (
                                <LightweightChart
                                    ref={chartRef}
                                    data={chartData}
                                    colors={{
                                        backgroundColor: '#09090b', // zinc-950
                                        textColor: '#a1a1aa',
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mr-2" />
                                    Loading Chart Data...
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right/Bottom: AI Analysis Results - Always Visible Placeholder - Takes 1/3 space */}
                    <Card className="flex-1 lg:max-w-[400px] border-border bg-card/60 backdrop-blur-md flex flex-col h-full">
                        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-400" />
                            <h3 className="font-semibold text-lg">AI Analysis</h3>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-sm max-w-none">
                            {decodeResult ? (
                                <ReactMarkdown>{decodeResult}</ReactMarkdown>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-4">
                                    <Brain className="h-16 w-16" />
                                    <p className="text-center">
                                        Click "Decode Chart" to generate<br />
                                        support/resistance and trend analysis.
                                    </p>
                                </div>
                            )}
                        </div>

                        {decodeResult && (
                            <div className="p-3 border-t border-border bg-muted/20 text-xs text-center text-muted-foreground">
                                Analysis by Gemini 1.5 Flash • {new Date().toLocaleTimeString()}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </Page>
    );
}
