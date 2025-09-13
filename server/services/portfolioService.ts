import { storage } from '../storage';
import { 
  type PortfolioPosition, 
  type TradeTransaction, 
  type PortfolioAnalytics,
  type MarketData,
  type InsertPortfolioAnalytics,
  type InsertTradeTransaction 
} from '@shared/schema';

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positions: EnrichedPosition[];
}

interface EnrichedPosition extends PortfolioPosition {
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: number; // percentage of total portfolio
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  bestTrade: number;
  worstTrade: number;
}

interface AssetAllocation {
  symbol: string;
  coin: string;
  value: number;
  percentage: number;
  quantity: number;
  color: string; // for charts
}

export class PortfolioService {
  
  /**
   * Calculate real-time portfolio summary with P&L
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    // Get user positions
    const positions = await storage.getPortfolioPositions(userId);
    
    if (positions.length === 0) {
      return {
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        positions: []
      };
    }

    // Get current market prices for all symbols
    const symbols = positions.map(p => p.symbol);
    const marketDataList = await this.getLatestPrices(symbols);
    const marketDataMap = new Map(marketDataList.map(md => [md.symbol, md]));

    // Calculate enriched positions
    const enrichedPositions: EnrichedPosition[] = [];
    let totalValue = 0;
    let totalCost = 0;

    for (const position of positions) {
      const marketData = marketDataMap.get(position.symbol);
      if (!marketData) continue;

      const currentPrice = parseFloat(marketData.price);
      const entryPrice = parseFloat(position.entryPrice);
      const quantity = parseFloat(position.quantity);
      
      const marketValue = currentPrice * quantity;
      const cost = entryPrice * quantity;
      const unrealizedPnL = marketValue - cost;
      const unrealizedPnLPercent = cost > 0 ? (unrealizedPnL / cost) * 100 : 0;
      
      const dayChange = marketData.priceChange24h ? parseFloat(marketData.priceChange24h) * quantity : 0;
      const dayChangePercent = marketData.priceChangePercent24h || 0;

      enrichedPositions.push({
        ...position,
        currentPrice,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        allocation: 0, // Will calculate after getting total
        dayChange,
        dayChangePercent,
        totalReturn: unrealizedPnL,
        totalReturnPercent: unrealizedPnLPercent
      });

      totalValue += marketValue;
      totalCost += cost;
    }

    // Calculate allocations
    enrichedPositions.forEach(pos => {
      pos.allocation = totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0;
    });

    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    
    const dayChange = enrichedPositions.reduce((sum, pos) => sum + pos.dayChange, 0);
    const dayChangePercent = totalCost > 0 ? (dayChange / totalCost) * 100 : 0;

    return {
      totalValue,
      totalPnL,
      totalPnLPercent,
      dayChange,
      dayChangePercent,
      positions: enrichedPositions.sort((a, b) => b.marketValue - a.marketValue)
    };
  }

  /**
   * Get asset allocation breakdown for pie charts
   */
  async getAssetAllocation(userId: string): Promise<AssetAllocation[]> {
    const summary = await this.getPortfolioSummary(userId);
    
    const colors = [
      '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
      '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#f97316'
    ];

    return summary.positions.map((position, index) => ({
      symbol: position.symbol,
      coin: position.symbol.replace('USDT', ''),
      value: position.marketValue,
      percentage: position.allocation,
      quantity: parseFloat(position.quantity),
      color: colors[index % colors.length]
    }));
  }

  /**
   * Calculate performance metrics vs market
   */
  async getPerformanceMetrics(userId: string, days: number = 30): Promise<PerformanceMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get transaction history for calculating metrics
    const transactions = await storage.getTradeTransactionsByDateRange(userId, startDate, endDate);
    
    if (transactions.length === 0) {
      return {
        totalReturn: 0,
        totalReturnPercent: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        avgWinPercent: 0,
        avgLossPercent: 0,
        bestTrade: 0,
        worstTrade: 0
      };
    }

    // Calculate basic metrics from transactions
    const trades = this.analyzeTransactions(transactions);
    const currentSummary = await this.getPortfolioSummary(userId);
    
    const totalReturn = currentSummary.totalPnL;
    const totalReturnPercent = currentSummary.totalPnLPercent;
    
    // Calculate win/loss metrics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWinPercent = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length 
      : 0;
    const avgLossPercent = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / losingTrades.length
      : 0;

    const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
    const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;

    return {
      totalReturn,
      totalReturnPercent,
      volatility: 0, // TODO: Implement volatility calculation
      sharpeRatio: 0, // TODO: Implement Sharpe ratio
      maxDrawdown: 0, // TODO: Implement max drawdown
      winRate,
      avgWinPercent,
      avgLossPercent,
      bestTrade,
      worstTrade
    };
  }

  /**
   * Add a new trade transaction
   */
  async addTransaction(userId: string, transaction: Omit<InsertTradeTransaction, 'userId'>): Promise<TradeTransaction> {
    const newTransaction = await storage.createTradeTransaction({
      ...transaction,
      userId
    });

    // Update portfolio positions based on transaction
    await this.updatePortfolioFromTransaction(userId, newTransaction);

    return newTransaction;
  }

  /**
   * Get transaction history with P&L calculations
   */
  async getTransactionHistory(userId: string, symbol?: string): Promise<TradeTransaction[]> {
    return await storage.getTradeTransactions(userId, symbol);
  }

  /**
   * Update portfolio analytics daily
   */
  async updateDailyAnalytics(userId: string): Promise<void> {
    const summary = await this.getPortfolioSummary(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analytics: InsertPortfolioAnalytics = {
      userId,
      date: today,
      totalValue: summary.totalValue.toString(),
      totalPnl: summary.totalPnL.toString(),
      totalPnlPercent: summary.totalPnLPercent,
      dayChange: summary.dayChange.toString(),
      dayChangePercent: summary.dayChangePercent,
      positions: summary.positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        currentPrice: p.currentPrice,
        marketValue: p.marketValue,
        unrealizedPnL: p.unrealizedPnL
      }))
    };

    await storage.createPortfolioAnalytics(analytics);
  }

  /**
   * Get latest market prices for symbols
   */
  private async getLatestPrices(symbols: string[]): Promise<MarketData[]> {
    // Convert base symbols to trading pairs (BTC -> BTCUSDT, ETH -> ETHUSDT)
    const tradingPairs = symbols.map(symbol => {
      // If already a trading pair, use as is
      if (symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH')) {
        return symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
      }
      return symbol + 'USDT';
    });
    
    // Try to get from cache first
    const cachedData = await storage.getMarketData(tradingPairs);
    
    // In a real implementation, you would fetch from Binance API here
    // For now, we'll use cached data or mock data
    if (cachedData.length === 0) {
      // Fetch from Binance API and cache
      const marketData: MarketData[] = [];
      
      for (let i = 0; i < tradingPairs.length; i++) {
        const tradingPair = tradingPairs[i];
        const baseSymbol = symbols[i]; // Original symbol for mapping
        
        try {
          const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${tradingPair}`);
          
          if (!response.ok) {
            console.error(`Binance API error for ${tradingPair}:`, response.status);
            // Create fallback data using entry price if available
            const fallbackPrice = await this.getFallbackPrice(baseSymbol);
            if (fallbackPrice > 0) {
              const fallbackData = {
                symbol: baseSymbol, // Use base symbol for mapping
                price: fallbackPrice.toString(),
                volume24h: "0",
                priceChange24h: "0",
                priceChangePercent24h: 0,
                high24h: fallbackPrice.toString(),
                low24h: fallbackPrice.toString(),
                marketCap: null,
              };
              const cached = await storage.upsertMarketData(fallbackData);
              marketData.push(cached);
            }
            continue;
          }
          
          const data = await response.json();
          
          // Validate that we have the required data
          if (!data.symbol || !data.lastPrice) {
            console.error(`Invalid data from Binance for ${tradingPair}:`, data);
            continue;
          }
          
          const marketDataEntry = {
            symbol: baseSymbol, // Use base symbol for consistency
            price: data.lastPrice.toString(),
            volume24h: data.volume.toString(),
            priceChange24h: data.priceChange.toString(),
            priceChangePercent24h: parseFloat(data.priceChangePercent) || 0,
            high24h: data.highPrice.toString(),
            low24h: data.lowPrice.toString(),
            marketCap: null,
          };
          
          // Cache the data
          const cached = await storage.upsertMarketData(marketDataEntry);
          marketData.push(cached);
        } catch (error) {
          console.error(`Failed to fetch price for ${baseSymbol}:`, error);
        }
      }
      
      return marketData;
    }
    
    return cachedData;
  }

  /**
   * Get fallback price from portfolio positions (entry price)
   */
  private async getFallbackPrice(symbol: string): Promise<number> {
    try {
      const positions = await storage.getPortfolioPositions(''); // Get all positions
      const position = positions.find(p => p.symbol === symbol);
      return position ? parseFloat(position.entryPrice) : 0;
    } catch (error) {
      console.error(`Error getting fallback price for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Analyze transactions for trade metrics
   */
  private analyzeTransactions(transactions: TradeTransaction[]): Array<{ pnl: number; pnlPercent: number }> {
    const trades: Array<{ pnl: number; pnlPercent: number }> = [];
    
    // Group transactions by symbol and calculate P&L for completed trades
    const positionMap = new Map<string, { buyQuantity: number; buyValue: number; sellValue: number }>();
    
    for (const tx of transactions) {
      const key = tx.symbol;
      const position = positionMap.get(key) || { buyQuantity: 0, buyValue: 0, sellValue: 0 };
      
      const quantity = parseFloat(tx.quantity);
      const price = parseFloat(tx.price);
      const value = quantity * price;
      
      if (tx.side === 'buy') {
        position.buyQuantity += quantity;
        position.buyValue += value;
      } else if (tx.side === 'sell') {
        // Calculate P&L for this sell
        const avgBuyPrice = position.buyQuantity > 0 ? position.buyValue / position.buyQuantity : 0;
        const sellValue = quantity * price;
        const costBasis = quantity * avgBuyPrice;
        const pnl = sellValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        
        trades.push({ pnl, pnlPercent });
        
        // Update position
        position.buyQuantity = Math.max(0, position.buyQuantity - quantity);
        position.buyValue = Math.max(0, position.buyValue - costBasis);
        position.sellValue += sellValue;
      }
      
      positionMap.set(key, position);
    }
    
    return trades;
  }

  /**
   * Update portfolio positions based on new transaction
   */
  private async updatePortfolioFromTransaction(userId: string, transaction: TradeTransaction): Promise<void> {
    const existingPositions = await storage.getPortfolioPositions(userId);
    const existingPosition = existingPositions.find(p => p.symbol === transaction.symbol);
    
    const quantity = parseFloat(transaction.quantity);
    const price = parseFloat(transaction.price);
    
    if (transaction.side === 'buy') {
      if (existingPosition) {
        // Update existing position (average price)
        const existingQuantity = parseFloat(existingPosition.quantity);
        const existingPrice = parseFloat(existingPosition.entryPrice);
        
        const newQuantity = existingQuantity + quantity;
        const newAvgPrice = ((existingQuantity * existingPrice) + (quantity * price)) / newQuantity;
        
        await storage.updatePortfolioPosition(existingPosition.id, userId, {
          quantity: newQuantity.toString(),
          entryPrice: newAvgPrice.toString()
        });
      } else {
        // Create new position
        await storage.createPortfolioPosition({
          userId,
          symbol: transaction.symbol,
          quantity: quantity.toString(),
          entryPrice: price.toString()
        });
      }
    } else if (transaction.side === 'sell' && existingPosition) {
      // Reduce position
      const existingQuantity = parseFloat(existingPosition.quantity);
      const newQuantity = existingQuantity - quantity;
      
      if (newQuantity <= 0) {
        // Close position
        await storage.deletePortfolioPosition(existingPosition.id, userId);
      } else {
        // Reduce quantity
        await storage.updatePortfolioPosition(existingPosition.id, userId, {
          quantity: newQuantity.toString()
        });
      }
    }
  }
}

export const portfolioService = new PortfolioService();