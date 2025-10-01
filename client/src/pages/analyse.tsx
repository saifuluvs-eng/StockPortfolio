import { FormEvent, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const DEFAULT_SYMBOL = "BTCUSDT";
const DEFAULT_TIMEFRAME = "240"; // 4h

const TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m" },
  { value: "60", label: "1hr", display: "1h" },
  { value: "240", label: "4hr", display: "4h" },
  { value: "D", label: "1Day", display: "1D" },
  { value: "W", label: "1Week", display: "1W" },
];

function normalizeSymbol(raw: string) {
  const trimmed = (raw || "").trim().toUpperCase();
  if (!trimmed) return DEFAULT_SYMBOL;
  return trimmed.endsWith("USDT") ? trimmed : `${trimmed}USDT`;
}

function displayPair(symbol: string) {
  const upper = (symbol || DEFAULT_SYMBOL).toUpperCase();
  return upper.endsWith("USDT") ? `${upper.slice(0, -4)}/USDT` : upper;
}

export default function Analyse() {
  const [searchInput, setSearchInput] = useState("BTC");
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);

  const displaySymbol = useMemo(() => displayPair(activeSymbol), [activeSymbol]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = normalizeSymbol(searchInput);
    setActiveSymbol(next);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <section className="grid gap-4 lg:grid-cols-[1.75fr_minmax(280px,_1fr)]">
        <Card className="bg-[#111111] border-[#1f1f1f]">
          <CardHeader className="flex flex-col gap-2 pb-4">
            <CardTitle className="text-xl font-semibold text-white">
              Analyse workspace
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Start by searching for a symbol and timeframe. We will wire the
              remaining modules one by one as we migrate features from Charts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <div className="flex-1 space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Symbol
                </label>
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="e.g. BTC or BTCUSDT"
                  className="h-11 rounded-lg border-[#2a2a2a] bg-[#151515] text-base text-white"
                />
              </div>

              <div className="w-full space-y-2 sm:w-40">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Timeframe
                </label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="h-11 rounded-lg border-[#2a2a2a] bg-[#151515] text-base text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] text-white">
                    {TIMEFRAMES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="mt-6 h-11 rounded-lg bg-white text-black hover:bg-gray-200 sm:mt-auto"
              >
                Update
              </Button>
            </form>

            <Separator className="my-6 bg-[#1f1f1f]" />

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#1f1f1f] bg-[#151515]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Selected pair
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-white">
                    {displaySymbol}
                  </span>
                  <Badge variant="secondary" className="rounded-full bg-[#222] text-white">
                    {timeframe}
                  </Badge>
                </CardContent>
              </Card>

              <Card className="border-[#1f1f1f] bg-[#151515]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Migration status
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    We will enable live data, charting, and technical outputs in
                    upcoming steps.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>
                      <Badge className="mr-2 bg-[#2d2d2d] text-white">Search</Badge>
                      Basic symbol + timeframe selection is ready.
                    </li>
                    <li>
                      <Badge className="mr-2 bg-[#2d2d2d] text-white">Chart</Badge>
                      Pending – TradingView embedding will be reintroduced next.
                    </li>
                    <li>
                      <Badge className="mr-2 bg-[#2d2d2d] text-white">Indicators</Badge>
                      Pending – technical breakdown will be migrated after chart.
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1f1f1f] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">
              Migration notes
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Reference items we still need from Charts/Scan while the new
              workspace takes shape.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px]">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>• TradingView chart with synced symbol + timeframe</li>
                <li>• Technical indicator summary + recommendation badges</li>
                <li>• Scan history and watchlist modules</li>
                <li>• High potential ideas and quick scan results</li>
                <li>• Binance live price stream for the header tiles</li>
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed border-[#2a2a2a] bg-transparent">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-muted-foreground">
              Chart module placeholder
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              This block will host the TradingView widget once we migrate it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No live chart yet. Use the Charts page for the existing experience
            while we wire this module.
          </CardContent>
        </Card>

        <Card className="border-dashed border-[#2a2a2a] bg-transparent">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-muted-foreground">
              Technical indicators placeholder
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              We will reuse the indicator scoring panel from Charts here.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Stay tuned—this area will show aggregated indicator signals once the
            data hooks are connected.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
