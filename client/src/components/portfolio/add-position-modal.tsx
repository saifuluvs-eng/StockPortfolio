import { useState } from "react";
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

const addPositionSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").regex(/^[A-Z]+USDT$/, "Symbol must end with USDT (e.g., BTCUSDT)"),
  quantity: z.string().min(1, "Quantity is required").regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  entryPrice: z.string().min(1, "Entry price is required").regex(/^\d+(\.\d+)?$/, "Must be a valid price"),
});

interface AddPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPositionModal({ open, onOpenChange }: AddPositionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof addPositionSchema>>({
    resolver: zodResolver(addPositionSchema),
    defaultValues: {
      symbol: "",
      quantity: "",
      entryPrice: "",
    },
  });

  const addPositionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addPositionSchema>) => {
      await apiRequest('POST', '/api/portfolio', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      toast({
        title: "Success",
        description: "Position added successfully",
      });
      form.reset();
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add position. Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof addPositionSchema>) => {
    addPositionMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-position">
        <DialogHeader>
          <DialogTitle>Add New Position</DialogTitle>
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
                      data-testid="input-symbol"
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
                      data-testid="input-quantity"
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
                      data-testid="input-entry-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addPositionMutation.isPending}
                data-testid="button-add-position-submit"
              >
                {addPositionMutation.isPending ? "Adding..." : "Add Position"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
