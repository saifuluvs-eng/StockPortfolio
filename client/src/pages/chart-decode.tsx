import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Page } from "@/components/layout/Layout";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { Search, Brain, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import TradingViewChart from "@/components/charts/TradingViewChart";
import ReactMarkdown from "react-markdown";

export default function ChartDecodePage() {
    const [match, params] = useRoute("/chart-decode/:symbol?");
    const [location, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();

    // Default symbol or from URL
    const initialSymbol = (params?.symbol || "BTCUSDT").toUpperCase();
    const [symbolInput, setSymbolInput] = useState(initialSymbol);
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const [technicals, setTechnicals] = useState<any>(null);

    // AI State
    const [isDecoding, setIsDecoding] = useState(false);
    const [decodeResult, setDecodeResult] = useState<string | null>(null);

    // Sync URL with selection
    useEffect(() => {
        if (selectedSymbol && selectedSymbol !== params?.symbol) {
            setLocation(`/chart-decode/${selectedSymbol}`);
        }
    }, [selectedSymbol, setLocation, params?.symbol]);

    // Update input when URL changes
    useEffect(() => {
        if (params?.symbol) {
            const s = params.symbol.toUpperCase();
            setSymbolInput(s);
            setSelectedSymbol(s);
            setDecodeResult(null); // Clear previous result on change
            fetchTechnicals(s);
        } else {
            // Ensure we have data for default if needed
            fetchTechnicals(selectedSymbol);
        }
    }, [params?.symbol]);

    // Fetch technicals silently to be ready for AI
    const fetchTechnicals = async (symbol: string) => {
        if (!symbol) return;
        try {
            const s = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
            // We reuse scanner scan to get fresh technicals
            const res = await api("/api/scanner/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: s, timeframe: "4h", userId: user?.id }),
            });
            if (res.ok) {
                const data = await res.json();
                setTechnicals(data);
            }
        } catch (e) {
            console.error("Failed to fetch technicals for decode:", e);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (symbolInput) {
            const upper = symbolInput.toUpperCase();
            setSelectedSymbol(upper);
        }
    };

    const handleDecode = async () => {
        if (!technicals) {
            toast.error("Still loading chart data... please wait.");
            await fetchTechnicals(selectedSymbol); // Try one more time
            return;
        }

        setIsDecoding(true);
        try {
            const res = await api("/api/ai/chart-decode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symbol: selectedSymbol,
                    timeframe: "4h",
                    technicals
                })
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
        <Page title="Chart Decode">
            <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
                {/* Top Bar: Search */}
                <div className="flex items-center justify-between gap-4">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Enter symbol (e.g. BTC)"
                                value={symbolInput}
                                onChange={(e) => setSymbolInput(e.target.value)}
                                className="pl-9 bg-card/50"
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            Load Asset
                        </Button>
                    </form>

                    <Button
                        size="lg"
                        onClick={handleDecode}
                        disabled={isDecoding}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]"
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

                {/* Main Split View */}
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

                    {/* Left/Top: TradingView Chart */}
                    <Card className="flex-1 min-h-[500px] lg:min-h-0 overflow-hidden border-border bg-card/40 backdrop-blur-sm">
                        <CardContent className="p-0 h-full relative">
                            <TradingViewChart symbol={selectedSymbol} />
                        </CardContent>
                    </Card>

                    {/* Right/Bottom: AI Analysis Results */}
                    {decodeResult && (
                        <Card className="flex-1 lg:max-w-[500px] border-border bg-card/60 backdrop-blur-md animate-in slide-in-from-right-10 duration-500 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-yellow-400" />
                                <h3 className="font-semibold text-lg">AI Pattern Breakdown</h3>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown>{decodeResult}</ReactMarkdown>
                            </div>
                            <div className="p-3 border-t border-border bg-muted/20 text-xs text-center text-muted-foreground">
                                Analysis by Gemini 1.5 Flash • {new Date().toLocaleTimeString()}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </Page>
    );
}
