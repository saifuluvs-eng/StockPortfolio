// client/src/pages/landing.tsx
import AuthButton from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Shield, BarChart3, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">CryptoTrader Pro</span>
          </div>

          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">
              Portfolio
            </Link>
            <Link href="/gainers" className="text-muted-foreground hover:text-foreground transition-colors">
              Gainers
            </Link>
            <Link href="/analyse/BTCUSDT" className="text-muted-foreground hover:text-foreground transition-colors">
              SCAN
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button data-testid="button-go-dashboard">Go to Dashboard</Button>
              </Link>
            ) : null}
            <div data-testid={isAuthenticated ? "button-logout" : "button-login"}>
              <AuthButton size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Professional Crypto Trading Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Advanced portfolio management, technical analysis, and market insights powered by Binance API. 
            Make informed trading decisions with our comprehensive suite of tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="gradient-primary" data-testid="button-open-dashboard">
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <div data-testid="button-get-started">
                <AuthButton size="md" className="gradient-primary !border-none !px-6 !py-3 text-base" />
              </div>
            )}
            <Link href="/analyse/BTCUSDT">
              <Button size="lg" variant="outline" data-testid="button-learn-more">
                Explore Charts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">Powerful Trading Tools</h2>
          <p className="text-muted-foreground text-lg">Everything you need to trade cryptocurrencies like a pro</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-effect border-border/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Portfolio Management</h3>
              <p className="text-muted-foreground text-sm">
                Track your investments with real-time P&amp;L calculations and performance analytics.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-border/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Technical Analysis</h3>
              <p className="text-muted-foreground text-sm">
                Advanced indicators including RSI, MACD, EMA, and custom scoring algorithms.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-border/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Market Scanner</h3>
              <p className="text-muted-foreground text-sm">
                Scan thousands of coins for emerging opportunities and market trends.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-border/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Real-time Data</h3>
              <p className="text-muted-foreground text-sm">
                Live market data powered by Binance API with WebSocket connections.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="glass-effect border-border/50">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Start Trading?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join traders who use CryptoTrader Pro to make informed decisions and maximize their profits.
            </p>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="gradient-primary" data-testid="button-start-trading">
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <div data-testid="button-start-trading">
                <AuthButton size="md" className="gradient-primary !border-none !px-6 !py-3 text-base" />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-muted-foreground">© {year} CryptoTrader Pro. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
