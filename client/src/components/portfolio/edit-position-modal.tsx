// client/src/components/portfolio/edit-position-modal.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

/* ----------------------------- types ----------------------------- */

const editPositionSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((s) => s.trim().toUpperCase())
    .transform((s) => (/(USDT|USDC|FDUSD|TUSD|BUSD|DAI)$/.test(s) ? s : `${s}USDT`))
    .refine((s) => /^[A-Z]+(USDT|USDC|FDUSD|TUSD|BUSD|DAI)$/.test(s), "Symbol must end with a quote asset (e.g., BTCUSDT)"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((val) => !isNaN(parseFloat(val.replace(/,/g, ""))) && parseFloat(val.replace(/,/g, "")) > 0, "Must be a valid number"),
  entryPrice: z
    .string()
    .min(1, "Entry price is required")
    .refine((val) => !isNaN(parseFloat(val.replace(/,/g, ""))) && parseFloat(val.replace(/,/g, "")) > 0, "Must be a valid price"),
});

type EditForm = z.infer<typeof editPositionSchema>;

interface PositionData {
  id: string;
  symbol: string;
  quantity: string;
  entryPrice: string;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioPosition {
  id: string;
  symbol: string;
  quantity: string;
  entryPrice: string;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positions: PortfolioPosition[];
}

interface EditPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PositionData | null;
}

/* ----------------------------- helpers ----------------------------- */

function n(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function recomputeSummary(positions: PortfolioPosition[]): PortfolioSummary {
  const totalValue = positions.reduce((a, p) => a + p.marketValue, 0);
  const totalPnL = positions.reduce((a, p) => a + p.unrealizedPnL, 0);
  const dayChange = positions.reduce((a, p) => a + p.dayChange, 0);
  const totalPnLPercent = totalValue ? (totalPnL / totalValue) * 100 : 0;
  const dayChangePercent = totalValue ? (dayChange / totalValue) * 100 : 0;

  const finalPositions = positions.map((p) => ({
    ...p,
    allocation: totalValue ? (p.marketValue / totalValue) * 100 : 0,
  }));

  return {
    totalValue,
    totalPnL,
    totalPnLPercent,
    dayChange,
    dayChangePercent,
    positions: finalPositions,
  };
}

/* ----------------------------- component ----------------------------- */

export function EditPositionModal({ open, onOpenChange, position }: EditPositionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { signInWithGoogle } = useAuth();

  const form = useForm<EditForm>({
    resolver: zodResolver(editPositionSchema),
    defaultValues: {
      symbol: "",
      quantity: "",
      entryPrice: "",
    },
  });

  // Sync form when position changes
  useEffect(() => {
    if (position && open) {
      form.reset({
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
      });
    }
  }, [position, open, form]);

  const editPositionMutation = useMutation({
    mutationFn: async (data: EditForm) => {
      if (!position) throw new Error("No position selected");
      // Clean numbers
      const cleaned = {
        ...data,
        quantity: data.quantity.replace(/,/g, ""),
        entryPrice: data.entryPrice.replace(/,/g, ""),
      };
      await apiRequest("PATCH", `/api/portfolio/${position.id}`, cleaned);
    },
    // Optimistic cache update for /api/portfolio so UI updates instantly
    onMutate: async (data) => {
      if (!position) return;
      await queryClient.cancelQueries({ queryKey: ["/api/portfolio"] });
      const prev = queryClient.getQueryData<PortfolioSummary>(["/api/portfolio"]);

      if (prev) {
        const edited = prev.positions.map((p) => {
          if (p.id !== position.id) return p;

          const qty = n(data.quantity);
          const entry = n(data.entryPrice);
          const cur = n(p.currentPrice);

          const marketValue = cur * qty;
          const costBasis = entry * qty;
          const unrealizedPnL = marketValue - costBasis;
          const unrealizedPnLPercent = costBasis ? (unrealizedPnL / costBasis) * 100 : 0;

          // Keep dayChange estimates as-is (we don't know 24h ref here)
          return {
            ...p,
            symbol: data.symbol,
            quantity: String(qty),
            entryPrice: String(entry),
            marketValue,
            unrealizedPnL,
            unrealizedPnLPercent,
            totalReturn: unrealizedPnL,
            totalReturnPercent: unrealizedPnLPercent,
          };
        });

        const next = recomputeSummary(edited);
        queryClient.setQueryData<PortfolioSummary>(["/api/portfolio"], next);
      }

      return { prev };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["/api/portfolio"], ctx.prev);
      }

      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }

      toast({
        title: "Error",
        description: "Failed to update position. Please check your input and try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Revalidate to get server truth
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({ title: "Success", description: "Position updated successfully" });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditForm) => {
    editPositionMutation.mutate(data);
  };

  const baseAsset = position ? position.symbol.replace(/(USDT|USDC|FDUSD|TUSD|BUSD|DAI)$/, "") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-edit-position">
        <DialogHeader>
          <DialogTitle>
            Edit Position{baseAsset ? ` - ${baseAsset}` : ""}
          </DialogTitle>
        </DialogHeader>

        {!position ? (
          <div className="py-6 text-sm text-muted-foreground">No position selected.</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., BTCUSDT"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-edit-symbol"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 0.5"
                        type="number"
                        step="any"
                        {...field}
                        data-testid="input-edit-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Price (USDT)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 45000.00"
                        type="number"
                        step="any"
                        {...field}
                        data-testid="input-edit-entry-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Current Position Info */}
              {position && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Current Position Info</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Price:</span>
                      <span className="ml-2 font-medium">${position.currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&amp;L:</span>
                      <span className={`ml-2 font-medium ${position.pnl >= 0 ? "text-accent" : "text-destructive"}`}>
                        {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editPositionMutation.isPending}
                  data-testid="button-save-position"
                >
                  {editPositionMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
