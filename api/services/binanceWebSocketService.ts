import WebSocket from 'ws';

interface PriceUpdate {
  symbol: string;
  price: string;
  timestamp: number;
}

interface TickerUpdate {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export class BinanceWebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();
  
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws';
  
  constructor() {
    console.log('🔌 BinanceWebSocketService initialized');
  }

  /**
   * Subscribe to real-time price updates for a symbol
   */
  subscribeToPriceUpdates(symbol: string, callback: (data: PriceUpdate) => void): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    this.callbacks.set(streamName, callback);
    
    if (!this.connections.has(streamName)) {
      this.createConnection(streamName);
    }
    
    this.subscribedSymbols.add(symbol);
    console.log(`📈 Subscribed to price updates for ${symbol}`);
  }

  /**
   * Subscribe to 24hr ticker statistics
   */
  subscribeToTicker(symbol: string, callback: (data: TickerUpdate) => void): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    this.callbacks.set(streamName, callback);
    
    if (!this.connections.has(streamName)) {
      this.createConnection(streamName);
    }
    
    this.subscribedSymbols.add(symbol);
    console.log(`📊 Subscribed to ticker data for ${symbol}`);
  }

  /**
   * Subscribe to multiple symbols at once
   */
  subscribeToMultipleSymbols(symbols: string[], callback: (data: any) => void): void {
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
    const streamName = 'multi_stream';
    
    this.callbacks.set(streamName, callback);
    this.createMultiStreamConnection(streams, streamName);
    
    symbols.forEach(symbol => this.subscribedSymbols.add(symbol));
    console.log(`📡 Subscribed to multiple symbols: ${symbols.join(', ')}`);
  }

  /**
   * Create a single stream WebSocket connection
   */
  private createConnection(streamName: string): void {
    const wsUrl = `${this.baseUrl}/${streamName}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log(`🟢 Connected to Binance stream: ${streamName}`);
      this.connections.set(streamName, ws);
      this.reconnectAttempts.set(streamName, 0); // Reset attempts on successful connection
    });

    ws.on('message', (data: Buffer) => {
      try {
        const parsedData = JSON.parse(data.toString());
        const callback = this.callbacks.get(streamName);
        
        if (callback) {
          // Transform Binance data to our format
          const transformedData = this.transformBinanceData(parsedData);
          callback(transformedData);
        }
      } catch (error) {
        console.error(`❌ Error parsing WebSocket data for ${streamName}:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`🔴 WebSocket error for ${streamName}:`, error);
      this.handleReconnection(streamName);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔴 WebSocket closed for ${streamName}: ${code} - ${reason}`);
      this.connections.delete(streamName);
      this.handleReconnection(streamName);
    });
  }

  /**
   * Create a multi-stream WebSocket connection
   */
  private createMultiStreamConnection(streams: string[], connectionName: string): void {
    const wsUrl = `${this.baseUrl.replace('/ws', '/stream')}?streams=${streams.join('/')}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log(`🟢 Connected to Binance multi-stream: ${streams.length} streams`);
      this.connections.set(connectionName, ws);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const parsedData = JSON.parse(data.toString());
        const callback = this.callbacks.get(connectionName);
        
        if (callback) {
          // Multi-stream data has a different format
          const transformedData = this.transformBinanceData(parsedData.data || parsedData);
          callback({ ...transformedData, stream: parsedData.stream });
        }
      } catch (error) {
        console.error(`❌ Error parsing multi-stream WebSocket data:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`🔴 Multi-stream WebSocket error:`, error);
      this.handleReconnection(connectionName, streams);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔴 Multi-stream WebSocket closed: ${code} - ${reason}`);
      this.connections.delete(connectionName);
      this.handleReconnection(connectionName, streams);
    });
  }

  /**
   * Transform Binance WebSocket data to our standardized format
   */
  private transformBinanceData(data: any): any {
    if (data.e === '24hrTicker') {
      // 24hr ticker data
      return {
        symbol: data.s,
        lastPrice: data.c,
        priceChange: data.p,      // Absolute price change (e.g., +1.25)
        priceChangePercent: data.P, // Percentage change (e.g., +5.25%)
        highPrice: data.h,
        lowPrice: data.l,
        volume: data.v,
        quoteVolume: data.q,
        timestamp: data.E
      };
    }
    
    return data;
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnection(streamName: string, streams?: string[]): void {
    const attempts = this.getReconnectAttempts(streamName) + 1;
    this.reconnectAttempts.set(streamName, attempts);

    const existingTimeout = this.reconnectTimeouts.get(streamName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const reconnectDelay = Math.min(1000 * Math.pow(2, attempts), 30000);
    
    const timeout = setTimeout(() => {
      console.log(`🔄 Attempting to reconnect ${streamName} (attempt ${attempts})...`);
      
      if (streams) {
        this.createMultiStreamConnection(streams, streamName);
      } else {
        this.createConnection(streamName);
      }
      
      this.reconnectTimeouts.delete(streamName);
    }, reconnectDelay);

    this.reconnectTimeouts.set(streamName, timeout);
  }

  /**
   * Get reconnection attempt count (simplified)
   */
  private getReconnectAttempts(streamName: string): number {
    return this.reconnectAttempts.get(streamName) || 0;
  }

  /**
   * Unsubscribe from a symbol
   */
  unsubscribe(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const ws = this.connections.get(streamName);
    
    if (ws) {
      ws.close();
      this.connections.delete(streamName);
      this.callbacks.delete(streamName);
    }
    
    this.subscribedSymbols.delete(symbol);
    console.log(`🔇 Unsubscribed from ${symbol}`);
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    console.log('🔴 Closing all WebSocket connections...');
    
    for (const [streamName, ws] of Array.from(this.connections.entries())) {
      ws.close();
    }
    
    for (const timeout of Array.from(this.reconnectTimeouts.values())) {
      clearTimeout(timeout);
    }
    
    this.connections.clear();
    this.callbacks.clear();
    this.reconnectTimeouts.clear();
    this.subscribedSymbols.clear();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { [symbol: string]: string } {
    const status: { [symbol: string]: string } = {};
    
    for (const symbol of Array.from(this.subscribedSymbols)) {
      const streamName = `${symbol.toLowerCase()}@ticker`;
      const ws = this.connections.get(streamName);
      
      if (!ws) {
        status[symbol] = 'disconnected';
      } else {
        switch (ws.readyState) {
          case WebSocket.OPEN:
            status[symbol] = 'connected';
            break;
          case WebSocket.CONNECTING:
            status[symbol] = 'connecting';
            break;
          case WebSocket.CLOSING:
            status[symbol] = 'closing';
            break;
          case WebSocket.CLOSED:
            status[symbol] = 'closed';
            break;
          default:
            status[symbol] = 'unknown';
        }
      }
    }
    
    return status;
  }
}

export const binanceWebSocketService = new BinanceWebSocketService();