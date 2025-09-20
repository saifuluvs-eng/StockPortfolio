import WebSocket from 'ws';
import { pusherService } from './pusherService';

interface TickerUpdate {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  timestamp: number;
}

export class BinanceWebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws';
  
  constructor() {
    console.log('🔌 BinanceWebSocketService initialized for Pusher proxying');
  }

  /**
   * Subscribe to a ticker and proxy updates to Pusher.
   * This is now a fire-and-forget operation from the perspective of the caller.
   */
  subscribeToTicker(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    
    if (this.connections.has(streamName)) {
      console.log(`Already subscribed to ${symbol}.`);
      return;
    }
    
    this.createConnection(streamName, symbol);
  }

  private createConnection(streamName: string, symbol: string): void {
    const wsUrl = `${this.baseUrl}/${streamName}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log(`🟢 Connected to Binance stream for ${symbol} to proxy to Pusher.`);
      this.connections.set(streamName, ws);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const parsedData = JSON.parse(data.toString());
        const transformedData = this.transformBinanceData(parsedData);
        
        // Trigger a Pusher event instead of using a callback
        // The channel is public, and the event is symbol-specific.
        pusherService.trigger('price-updates', transformedData.symbol, transformedData);

      } catch (error) {
        console.error(`❌ Error parsing WebSocket data for ${streamName}:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`🔴 WebSocket error for ${streamName}:`, error);
      // We can still handle reconnection internally
      this.handleReconnection(streamName, symbol);
    });

    ws.on('close', () => {
      console.log(`🔴 WebSocket closed for ${streamName}.`);
      this.connections.delete(streamName);
      this.handleReconnection(streamName, symbol);
    });
  }

  private transformBinanceData(data: any): TickerUpdate {
    return {
      symbol: data.s,
      lastPrice: data.c,
      priceChange: data.p,
      priceChangePercent: data.P,
      highPrice: data.h,
      lowPrice: data.l,
      volume: data.v,
      quoteVolume: data.q,
      timestamp: data.E
    };
  }

  private handleReconnection(streamName: string, symbol: string): void {
    const existingTimeout = this.reconnectTimeouts.get(streamName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const reconnectDelay = 5000; // Simple 5-second reconnect
    
    const timeout = setTimeout(() => {
      console.log(`🔄 Attempting to reconnect ${streamName}...`);
      this.createConnection(streamName, symbol);
      this.reconnectTimeouts.delete(streamName);
    }, reconnectDelay);

    this.reconnectTimeouts.set(streamName, timeout);
  }

  unsubscribe(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const ws = this.connections.get(streamName);
    
    if (ws) {
      ws.close();
      this.connections.delete(streamName);
    }
    
    const timeout = this.reconnectTimeouts.get(streamName);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(streamName);
    }
    
    console.log(`🔇 Unsubscribed from ${symbol}`);
  }
}

export const binanceWebSocketService = new BinanceWebSocketService();