import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RsiHeatmap } from '@/components/data/RsiHeatmap';
import { Page } from '@/components/layout/Layout';

export default function DataPage() {
    const { data: rsiData, isLoading } = useQuery({
        queryKey: ['marketRsi'],
        queryFn: async () => {
            const res = await fetch('/api/market/rsi?limit=60');
            if (!res.ok) throw new Error('Failed to fetch RSI data');
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
                </div>

                <RsiHeatmap data={rsiData || []} isLoading={isLoading} />
            </div>
        </Page>
    );
}
