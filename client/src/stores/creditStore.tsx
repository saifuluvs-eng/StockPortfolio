import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type CreditContextValue = {
  credits: number;
  canSpend: (amount: number) => boolean;
  consume: (amount: number) => boolean;
};

const CreditContext = createContext<CreditContextValue | undefined>(undefined);

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState(20);

  const canSpend = useCallback(
    (amount: number) => {
      return credits >= amount;
    },
    [credits],
  );

  const consume = useCallback((amount: number) => {
    let success = false;
    setCredits((previous) => {
      if (previous >= amount) {
        success = true;
        return previous - amount;
      }
      return previous;
    });
    return success;
  }, []);

  const value = useMemo(
    () => ({
      credits,
      canSpend,
      consume,
    }),
    [credits, canSpend, consume],
  );

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}

export function useCreditStore() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCreditStore must be used within a CreditProvider");
  }
  return context;
}

export const useCredits = useCreditStore;
