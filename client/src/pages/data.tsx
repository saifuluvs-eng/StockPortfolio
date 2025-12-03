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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [
    { value: "15m", label: "15 Minutes" },
    { value: "1h", label: "1 Hour" },
    { value: "4h", label: "4 Hours" },
    { value: "1d", label: "1 Day" },
    { value: "1w", label: "1 Week" },
];

export default function DataPage() {
    const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["4h"]);
    const [source, setSource] = useState("volume");
    const [openTf, setOpenTf] = useState(false);

    const toggleTimeframe = (tf: string) => {
        setSelectedTimeframes(current => {
            if (current.includes(tf)) {
                // Don't allow deselecting the last one
                if (current.length === 1) return current;
                return current.filter(t => t !== tf);
            } else {
                return [...current, tf];
            }
        });
    };

    const selectAllTimeframes = () => {
        if (selectedTimeframes.length === TIMEFRAMES.length) {
            setSelectedTimeframes(["4h"]); // Reset to default
        } else {
            setSelectedTimeframes(TIMEFRAMES.map(t => t.value));
        }
    };

    const { data: rsiData, isLoading, error, refetch, dataUpdatedAt } = useQuery({
        queryKey: ['marketRsi', selectedTimeframes.join(','), source],
        queryFn: async () => {
            const tfParam = selectedTimeframes.join(',');
            const res = await fetch(`/api/market/rsi?limit=60&timeframe=${tfParam}&source=${source}`);
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

                    <div className="flex flex-wrap gap-3 items-start">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-zinc-500 font-medium ml-1">Timeframe</label>
                            <Popover open={openTf} onOpenChange={setOpenTf}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openTf}
                                        className="w-[180px] justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                                    >
                                        {selectedTimeframes.length === 0
                                            ? "Select timeframe"
                                            : selectedTimeframes.length === 1
                                                ? TIMEFRAMES.find((t) => t.value === selectedTimeframes[0])?.label
                                                : `${selectedTimeframes.length} selected`}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0 bg-zinc-950 border-zinc-800">
                                    <div className="p-2">
                                        <div
                                            className="flex items-center space-x-2 p-2 hover:bg-zinc-900 rounded cursor-pointer mb-1 border-b border-zinc-900"
                                            onClick={selectAllTimeframes}
                                        >
                                            <div className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selectedTimeframes.length === TIMEFRAMES.length ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span className="text-sm font-medium">Select All</span>
                                        </div>
                                        {TIMEFRAMES.map((tf) => (
                                            <div
                                                key={tf.value}
                                                className="flex items-center space-x-2 p-2 hover:bg-zinc-900 rounded cursor-pointer"
                                                onClick={() => toggleTimeframe(tf.value)}
                                            >
                                                <div className={cn(
                                                    "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    selectedTimeframes.includes(tf.value) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                <span className="text-sm">{tf.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
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

                        <div className="flex flex-col gap-1.5 items-end">
                            <label className="text-xs text-zinc-500 font-medium ml-1 opacity-0">Refresh</label>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => refetch()}
                                className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-white w-10"
                                disabled={isLoading}
                            >
                                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            </Button>
                            {dataUpdatedAt && (
                                <span className="text-[10px] text-zinc-500 font-mono mt-1">
                                    Updated: {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* DEBUG INFO */}
                <div className="p-4 bg-zinc-900 rounded border border-zinc-800 text-xs font-mono flex items-center justify-between">
                    <div className="flex gap-4">
                        <p>Status: <span className={isLoading ? "text-yellow-500" : "text-green-500"}>{isLoading ? 'Loading...' : 'Ready'}</span></p>
                        <p>Count: {rsiData?.length || 0}</p>
                        <p>TF: {selectedTimeframes.join(', ')}</p>
                        <p>Source: {source}</p>
                    </div>
                    {error && <p className="text-red-500">Error: {error.message}</p>}
                </div>

                <RsiHeatmap data={rsiData || []} isLoading={isLoading} />
            </div>
        </Page>
    );
}
