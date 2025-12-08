import React, { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Page } from "@/components/layout/Layout";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { Search, Brain, Sparkles, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ChartAnalysisPanel, { ChartAnalysisPanelRef } from "@/components/analyse/ChartAnalysisPanel";
import { extractScanResult } from "@/lib/scanner-results";

export default function ChartDecodePage() {
    const [match, params] = useRoute("/chart-decode/:symbol?");
    const [location, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();

    // Default symbol or from URL
    const initialSymbol = (params?.symbol || "").toUpperCase();
    const [symbolInput, setSymbolInput] = useState(initialSymbol);
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);

    // Data state
    const [isLoading, setIsLoading] = useState(false);
    const [scanData, setScanData] = useState<any>(null);
    const chartPanelRef = useRef<ChartAnalysisPanelRef>(null);

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
        }
    }, [params?.symbol]);

    // Fetch Data Logic
    const fetchData = async (symbol: string) => {
        if (!symbol) return;

        setIsLoading(true);
        setScanData(null);

        try {
            const s = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;

            // We use the scanner endpoint to get technicals + candles
            // Reuse logic from analyse.tsx
            const res = await api("/api/scanner/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symbol: s,
                    timeframe: "4h", // Default to 4h for best AI analysis
                    userId: user?.id
                }),
            });

            if (!res.ok) throw new Error("Failed to fetch market data");

            const payload = await res.json();
            const result = extractScanResult(payload);

            if (result) {
                setScanData(result);
                toast.success(`Data loaded for ${s}`);
            } else {
                toast.error("Could not analyze this symbol");
            }

        } catch (error) {
            console.error("Decode fetch error:", error);
            toast.error("Failed to load chart data");
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger fetch on mount or symbol change
    useEffect(() => {
        if (initialSymbol) {
            fetchData(initialSymbol);
        }
    }, []); // Only on mount if URL has symbol, for subsequent we use the button/search

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (symbolInput) {
            const upper = symbolInput.toUpperCase();
            setSelectedSymbol(upper);
            fetchData(upper);
        }
    };

    return (
        <Page>
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <Brain className="w-8 h-8 text-indigo-400" />
                            Chart <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Decode</span>
                        </h1>
                        <p className="text-zinc-400 mt-2">
                            AI-powered technical analysis engine. Paste a ticker to decode the matrix.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="relative w-full md:w-96">
                        <Input
                            value={symbolInput}
                            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                            placeholder="Search coin (e.g. BTC)..."
                            className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 focus:border-indigo-500/50 transition-all font-mono"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Button
                            type="submit"
                            className="absolute right-1 top-1 bottom-1 h-auto bg-indigo-600 hover:bg-indigo-500 text-xs uppercase font-bold tracking-wider"
                            disabled={isLoading}
                        >
                            {isLoading ? "Loading..." : "Decode"}
                        </Button>
                    </form>
                </div>

                {/* Main Content */}
                {!selectedSymbol && !scanData ? (
                    <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Sparkles className="w-10 h-10 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Ready to Decode</h2>
                        <p className="text-zinc-500 max-w-sm mx-auto">
                            Enter a cryptocurrency symbol above to let our AI analyze technical patterns, indicators, and price action in real-time.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Context Info */}
                        {scanData && (
                            <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{scanData.symbol}</h2>
                                    <span className="text-sm text-zinc-500">4H Timeframe Analysis</span>
                                </div>
                                <div className="ml-auto text-right">
                                    <div className="text-xl font-mono text-white">${scanData.price?.toFixed(scanData.price < 1 ? 6 : 2)}</div>
                                    <div className={`text-sm font-medium ${(scanData.technicals?.rsi?.value || 50) > 70 ? 'text-rose-400' : (scanData.technicals?.rsi?.value || 50) < 30 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                        RSI: {scanData.technicals?.rsi?.value?.toFixed(1) || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Analysis Panel */}
                        <ChartAnalysisPanel
                            ref={chartPanelRef}
                            symbol={selectedSymbol}
                            tf="4h"
                            technicals={scanData?.indicators} // API returns indicators, extractScanResult might map it differently, usually it's in indicators
                            candles={scanData?.candles}
                        />

                        {/* Loading State Overlay */}
                        {isLoading && (
                            <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                                <div className="text-center">
                                    <Brain className="w-12 h-12 text-indigo-500 animate-pulse mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-white">Extracting Matrix Data...</h3>
                                </div>
                            </div>
                        )}

                        {!isLoading && !scanData && selectedSymbol && (
                            <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-xl">
                                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-white">Data Unavailable</h3>
                                <p className="text-zinc-500 mt-2">Could not fetch technical data for {selectedSymbol}. Please try another coin.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Page>
    );
}
