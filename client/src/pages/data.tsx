import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RsiHeatmap } from '@/components/data/RsiHeatmap';
import { Page } from '@/components/layout/Layout';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function DataPage() {
    const [timeframe, setTimeframe] = useState("4h");
    const [source, setSource] = useState("volume");

    const { data: rsiData, isLoading, error } = useQuery({
        queryKey: ['marketRsi', timeframe, source],
        queryFn: async () => {
            const res = await fetch(`/api/market/rsi?limit=60&timeframe=${timeframe}&source=${source}`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to fetch RSI data: ${res.status} ${text}`);
            }
            return res.json();
        },
        refetchInterval: 60000, // Refresh every minute
    });

    return (
        <Page>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight text-white">Market Data</h1>
                        <p className="text-zinc-400">
                            Real-time technical indicators across the crypto market.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-zinc-500 font-medium ml-1">Timeframe</label>
                            <Select value={timeframe} onValueChange={setTimeframe}>
                                <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-800">
                                    <SelectValue placeholder="Timeframe" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15m">15 Minutes</SelectItem>
                                    <SelectItem value="1h">1 Hour</SelectItem>
                                    <SelectItem value="4h">4 Hours</SelectItem>
                                    <SelectItem value="1d">1 Day</SelectItem>
                                    <SelectItem value="1w">1 Week</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-zinc-500 font-medium ml-1">Source</label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-800">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="volume">Top Volume</SelectItem>
                                    <SelectItem value="gainers">Top Gainers</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* DEBUG INFO */}
                <div className="p-4 bg-zinc-900 rounded border border-zinc-800 text-xs font-mono flex items-center justify-between">
                    <div className="flex gap-4">
                        <p>Status: <span className={isLoading ? "text-yellow-500" : "text-green-500"}>{isLoading ? 'Loading...' : 'Ready'}</span></p>
                        <p>Count: {rsiData?.length || 0}</p>
                        <p>TF: {timeframe}</p>
                        <p>Source: {source}</p>
                    </div>
                    {error && <p className="text-red-500">Error: {error.message}</p>}
                </div>

                <RsiHeatmap data={rsiData || []} isLoading={isLoading} />
            </div>
        </Page>
    );
}
