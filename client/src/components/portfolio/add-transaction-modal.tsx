// client/src/components/portfolio/add-transaction-modal.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";

const addTransactionSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((s) => s.trim().toUpperCase()),
  side: z.enum(["buy", "sell"], { required_error: "Side is required" }),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Invalid quantity"),
  price: z
    .string()
    .min(1, "Price is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Invalid price"),
  fee: z.string().optional().refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Invalid fee"),
  feeAsset: z.string().optional(),
  executedAt: z.string().min(1, "Execution date is required"),
  notes: z.string().optional(),
});

type AddTransactionFormData = z.infer<typeof addTransactionSchema>;

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** format a Date to "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local"> */
function localDatetimeInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function normalizeSymbolMaybeAppendUSDT(s: string) {
  const u = s.trim().toUpperCase();
  if (!u) return u;
  // If already ends with a common quote asset, keep as-is; else default to USDT.
  if (/(USDT|USDC|FDUSD|TUSD|BUSD|DAI)$/.test(u)) return u;
  return `${u}USDT`;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { signInWithGoogle, user } = useAuth();
  const userId = user?.uid ?? null;
  const positionsKey = portfolioPositionsQueryKey(userId);

  const form = useForm<AddTransactionFormData>({
    resolver: zodResolver(addTransactionSchema),
    defaultValues: {
      symbol: "",
      side: "buy",
      quantity: "",
      price: "",
      fee: "0",
      feeAsset: "USDT",
      executedAt: localDatetimeInputValue(),
      notes: "",
    },
  });

  const addTransactionMutation = useMutation({
    // Try API; if it 404s/500s, we still keep the optimistic update (UI remains responsive).
    mutationFn: async (data: AddTransactionFormData) => {
      const transactionData = {
        ...data,
        quantity: data.quantity,
        price: data.price,
        fee: data.fee || "0",
        executedAt: data.executedAt, // server will parse
      };
      return await apiRequest("POST", "/api/portfolio/transactions", transactionData);
    },
    onMutate: async (data) => {
      // Optimistically add to transactions list
      await queryClient.cancelQueries({ queryKey: ["/api/portfolio/transactions"] });
      const prev = queryClient.getQueryData<any[]>(["/api/portfolio/transactions"]) || [];

      const optimistic = {
        id: `local_${Date.now()}`,
        symbol: normalizeSymbolMaybeAppendUSDT(data.symbol),
        side: data.side,
        quantity: data.quantity,
        price: data.price,
        fee: data.fee || "0",
        feeAsset: data.feeAsset || "USDT",
        executedAt: data.executedAt,
        createdAt: new Date().toISOString(),
        notes: data.notes || "",
      };

      queryClient.setQueryData<any[]>(["/api/portfolio/transactions"], [optimistic, ...prev]);

      return { prev };
    },
    onError: (error, _vars, context) => {
      // rollback optimistic change
      if (context?.prev) {
        queryClient.setQueryData(["/api/portfolio/transactions"], context.prev);
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
        description: "Failed to add transaction",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Refetch server truth
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/transactions"] });
      queryClient.invalidateQueries({ queryKey: positionsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/performance"] });

      toast({
        title: "Success",
        description: "Transaction added successfully",
      });

      form.reset({
        symbol: "",
        side: "buy",
        quantity: "",
        price: "",
        fee: "0",
        feeAsset: "USDT",
        executedAt: localDatetimeInputValue(),
        notes: "",
      });
      onOpenChange(false);
    },
  });

  const onSubmit = (raw: AddTransactionFormData) => {
    // Clean numeric fields and normalize symbol
    const cleanedData: AddTransactionFormData = {
      ...raw,
      symbol: normalizeSymbolMaybeAppendUSDT(raw.symbol),
      quantity: raw.quantity.replace(/,/g, ""),
      price: raw.price.replace(/,/g, ""),
      fee: raw.fee ? raw.fee.replace(/,/g, "") : raw.fee,
    };
    addTransactionMutation.mutate(cleanedData);
  };

  const handleSymbolChange = (value: string) => {
    form.setValue("symbol", value.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Coin</DialogTitle>
          <DialogDescription>
            Record a buy or sell transaction for a cryptocurrency to track your portfolio performance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="BTCUSDT, ETHUSDT, SOLUSDT..."
                {...form.register("symbol")}
                onChange={(e) => handleSymbolChange(e.target.value)}
                data-testid="input-symbol"
              />
              {form.formState.errors.symbol && (
                <p className="text-sm text-destructive">{form.formState.errors.symbol.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="side">Side</Label>
              <Select value={form.watch("side")} onValueChange={(v) => form.setValue("side", v as "buy" | "sell")}>
                <SelectTrigger data-testid="select-side">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                placeholder="0.00000000"
                type="number"
                step="any"
                inputMode="decimal"
                {...form.register("quantity")}
                data-testid="input-quantity"
              />
              {form.formState.errors.quantity && (
                <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                placeholder="0.00"
                type="number"
                step="any"
                inputMode="decimal"
                {...form.register("price")}
                data-testid="input-price"
              />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Fee (optional)</Label>
              <Input
                id="fee"
                placeholder="0.00"
                type="number"
                step="any"
                inputMode="decimal"
                {...form.register("fee")}
                data-testid="input-fee"
              />
              {form.formState.errors.fee && (
                <p className="text-sm text-destructive">{form.formState.errors.fee.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feeAsset">Fee Asset</Label>
              <Select value={form.watch("feeAsset")} onValueChange={(v) => form.setValue("feeAsset", v)}>
                <SelectTrigger data-testid="select-fee-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="executedAt">Execution Time</Label>
            <Input id="executedAt" type="datetime-local" {...form.register("executedAt")} data-testid="input-executed-at" />
            {form.formState.errors.executedAt && (
              <p className="text-sm text-destructive">{form.formState.errors.executedAt.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this transaction..."
              {...form.register("notes")}
              data-testid="input-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={addTransactionMutation.isPending} data-testid="button-add-transaction">
              {addTransactionMutation.isPending ? "Adding..." : "Add Coin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
