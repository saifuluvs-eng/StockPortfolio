import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, Search, Plus, History, TrendingUp, Clock } from "lucide-react";

interface Transaction {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  fee?: string;
  feeAsset?: string;
  tradeId?: string;
  executedAt: string;
  notes?: string;
  createdAt: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onAddTransaction?: () => void;
}

export function TransactionHistory({ transactions, isLoading, onAddTransaction }: TransactionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSide, setFilterSide] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const filteredTransactions = transactions
    .filter(tx => {
      const matchesSearch = tx.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.side.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterSide === "all" || tx.side === filterSide;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime();
        case "symbol":
          return a.symbol.localeCompare(b.symbol);
        case "value":
          return parseFloat(b.price) * parseFloat(b.quantity) - parseFloat(a.price) * parseFloat(a.quantity);
        default: // newest
          return new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime();
      }
    });

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateValue = (price: string, quantity: string) => {
    return parseFloat(price) * parseFloat(quantity);
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <History className="w-5 h-5" />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Transaction History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading transaction history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
              </div>
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Buy Orders</p>
                <p className="text-2xl font-bold text-accent">
                  {transactions.filter(tx => tx.side === 'buy').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sell Orders</p>
                <p className="text-2xl font-bold text-destructive">
                  {transactions.filter(tx => tx.side === 'sell').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold text-foreground">
                  ${transactions.reduce((sum, tx) => sum + calculateValue(tx.price, tx.quantity), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <History className="w-5 h-5" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Transaction History</span>
            </CardTitle>
            {onAddTransaction && (
              <Button onClick={onAddTransaction} data-testid="button-add-transaction">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol or side..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={filterSide} onValueChange={setFilterSide}>
              <SelectTrigger className="w-32" data-testid="select-filter-side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="buy">Buy Only</SelectItem>
                <SelectItem value="sell">Sell Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="symbol">Symbol</SelectItem>
                <SelectItem value="value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {transactions.length === 0 ? "No transactions found" : "No transactions match your filters"}
              </p>
              {onAddTransaction && (
                <Button onClick={onAddTransaction} data-testid="button-add-first-transaction">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Transaction
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-left p-4 text-muted-foreground font-medium">Asset</th>
                    <th className="text-left p-4 text-muted-foreground font-medium">Side</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Quantity</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Price</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Value</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const baseAsset = transaction.symbol.replace('USDT', '');
                    const value = calculateValue(transaction.price, transaction.quantity);
                    
                    return (
                      <tr key={transaction.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {formatDateTime(transaction.executedAt)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-primary-foreground">
                                {baseAsset.slice(0, 3)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{baseAsset}</p>
                              <p className="text-sm text-muted-foreground">{transaction.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={transaction.side === 'buy' ? 'default' : 'destructive'}
                            className="flex items-center gap-1 w-fit"
                          >
                            {transaction.side === 'buy' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {transaction.side.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-4 text-right text-foreground" data-testid={`text-quantity-${transaction.id}`}>
                          {parseFloat(transaction.quantity).toFixed(8)}
                        </td>
                        <td className="p-4 text-right text-foreground">
                          ${parseFloat(transaction.price).toFixed(2)}
                        </td>
                        <td className="p-4 text-right text-foreground font-medium">
                          ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right text-muted-foreground">
                          {transaction.fee ? `${transaction.fee} ${transaction.feeAsset || 'USDT'}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}