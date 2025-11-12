// client/src/pages/landing.tsx
import { useState } from "react";
import AuthButton from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TrendingUp, Shield, BarChart3, Users, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const year = new Date().getFullYear();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/gainers", label: "Gainers" },
    { href: "/analyse/BTCUSDT", label: "SCAN" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-foreground">CryptoTrader Pro</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button data-testid="button-go-dashboard" className="min-h-[44px]">
                  Go to Dashboard
                </Button>
              </Link>
            ) : null}
            <div data-testid={isAuthenticated ? "button-logout" : "button-login"}>
              <AuthButton size="sm" />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span>Menu</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="ghost" className="w-full justify-start min-h-[44px] text-base">
                      {link.label}
                    </Button>
                  </Link>
                ))}
                <div className="pt-4 border-t border-border">
                  {isAuthenticated ? (
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full min-h-[44px]" data-testid="button-go-dashboard-mobile">
                        Go to Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <div className="w-full" data-testid="button-login-mobile">
                      <AuthButton size="md" />
                    </div>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
            Professional Crypto Trading Platform
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed px-2">
            Advanced portfolio management, technical analysis, and market insights powered by Binance API. 
            Make informed trading decisions with our comprehensive suite of tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="gradient-primary w-full sm:w-auto min-h-[48px]" data-testid="button-open-dashboard">
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <div data-testid="button-get-started" className="w-full sm:w-auto">
                <AuthButton size="md" className="gradient-primary !border-none !px-6 !py-3 text-base w-full sm:w-auto min-h-[48px]" />
              </div>
            )}
            <Link href="/analyse/BTCUSDT" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-h-[48px]" data-testid="button-learn-more">
                Explore Charts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Powerful Trading Tools</h2>
          <p className="text-muted-foreground text-base sm:text-lg px-4">Everything you need to trade cryptocurrencies like a pro</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
      <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <Card className="glass-effect border-border/50">
          <CardContent className="p-6 sm:p-8 md:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Ready to Start Trading?</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              Join traders who use CryptoTrader Pro to make informed decisions and maximize their profits.
            </p>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="gradient-primary min-h-[48px] w-full sm:w-auto" data-testid="button-start-trading">
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <div data-testid="button-start-trading" className="w-full sm:w-auto inline-block">
                <AuthButton size="md" className="gradient-primary !border-none !px-6 !py-3 text-base w-full sm:w-auto min-h-[48px]" />
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
