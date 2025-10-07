import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CreditStore = {
  credits: number;
  canSpend: (amount: number) => boolean;
  spend: (amount: number, memo: string, meta?: any) => boolean;
  refund: (amount: number, memo: string, meta?: any) => void;
  grant: (amount: number) => void;
};

const storage =
  typeof window === "undefined"
    ? undefined
    : createJSONStorage(() => window.localStorage);

const persistOptions = {
  name: "credits:v1",
  partialize: (state: CreditStore) => ({ credits: state.credits }),
  ...(storage ? { storage } : {}),
};

export const useCredits = create<CreditStore>()(
  persist(
    (set, get) => ({
      credits: 20,
      canSpend: (amount: number) => get().credits >= amount,
      spend: (amount: number, _memo: string, _meta?: any) => {
        if (get().credits < amount) {
          return false;
        }
        set((state) => ({ credits: state.credits - amount }));
        return true;
      },
      refund: (amount: number, _memo: string, _meta?: any) => {
        set((state) => ({ credits: state.credits + amount }));
      },
      grant: (amount: number) => {
        set((state) => ({ credits: state.credits + amount }));
      },
    }),
    persistOptions,
  ),
);

export const useCreditStore = useCredits;
