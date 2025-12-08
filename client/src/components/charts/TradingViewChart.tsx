import React, { useEffect, useRef, memo } from 'react';

type TradingViewChartProps = {
    symbol: string;
    theme?: 'light' | 'dark';
    autosize?: boolean;
};

const TradingViewChart: React.FC<TradingViewChartProps> = ({
    symbol,
    theme = 'dark',
    autosize = true
}) => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Clear previous widget
        container.current.innerHTML = "";

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": autosize,
            "symbol": `BINANCE:${symbol}`,
            "interval": "240",
            "timezone": "Etc/UTC",
            "theme": theme,
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "support_host": "https://www.tradingview.com"
        });

        container.current.appendChild(script);

        return () => {
            // Cleanup if needed, though clearing innerHTML handles most
        };
    }, [symbol, theme, autosize]);

    return (
        <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
            <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }}></div>
        </div>
    );
};

export default memo(TradingViewChart);
