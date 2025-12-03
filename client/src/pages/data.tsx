import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RsiHeatmap } from '@/components/data/RsiHeatmap';
import { Page } from '@/components/layout/Layout';

export default function DataPage() {
    const { data: rsiData, isLoading, error } = useQuery({
        queryKey: ['marketRsi'],
        queryFn: async () => {
            const res = await fetch('/api/market/rsi?limit=60');
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
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Market Data</h1>
                    <p className="text-zinc-400">
                        Real-time technical indicators across the crypto market.
                    </p>
                    {/* DEBUG INFO */}
                    <div className="p-4 bg-zinc-900 rounded border border-zinc-800 text-xs font-mono">
                        <p>Status: {isLoading ? 'Loading...' : 'Ready'}</p>
                        <p>Data Count: {rsiData?.length || 0}</p>
                        {error && <p className="text-red-500">Error: {error.message}</p>}
                    </div>
                </div>

                <RsiHeatmap data={rsiData || []} isLoading={isLoading} />
            </div>
        </Page>
    );
}
