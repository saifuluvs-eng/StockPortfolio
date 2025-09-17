import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const editPositionSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").regex(/^[A-Z]+USDT$/, "Symbol must end with USDT (e.g., BTCUSDT)"),
  quantity: z.string().min(1, "Quantity is required").regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  entryPrice: z.string().min(1, "Entry price is required").regex(/^\d+(\.\d+)?$/, "Must be a valid price"),
});

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

interface EditPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PositionData | null;
}

export function EditPositionModal({ open, onOpenChange, position }: EditPositionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof editPositionSchema>>({
    resolver: zodResolver(editPositionSchema),
    defaultValues: {
      symbol: "",
      quantity: "",
      entryPrice: "",
    },
  });

  // Update form when position changes
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
    mutationFn: async (data: z.infer<typeof editPositionSchema>) => {
      if (!position) throw new Error("No position selected");
      await apiRequest('PATCH', `/api/portfolio/${position.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      toast({
        title: "Success",
        description: "Position updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/google";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update position. Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editPositionSchema>) => {
    // Strip commas from numeric fields before sending to backend
    const cleanedData = {
      ...data,
      quantity: data.quantity.replace(/,/g, ''),
      entryPrice: data.entryPrice.replace(/,/g, ''),
    };
    editPositionMutation.mutate(cleanedData);
  };

  const baseAsset = position ? position.symbol.replace('USDT', '') : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-edit-position">
        <DialogHeader>
          <DialogTitle>Edit Position - {baseAsset}</DialogTitle>
        </DialogHeader>
        
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
                    <span className="text-muted-foreground">P&L:</span>
                    <span className={`ml-2 font-medium ${position.pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
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
      </DialogContent>
    </Dialog>
  );
}
