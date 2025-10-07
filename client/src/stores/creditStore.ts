import { create } from "zustand";

export type CreditTxn = {
  id: string;
  at: number;
  cost: number;
  memo: string;
  symbol?: string;
  tf?: string;
};

type State = {
  ready: boolean;
  userId: string | null;
  credits: number;
  txns: CreditTxn[];
  init: (userId: string | null) => void;
  canSpend: (n: number) => boolean;
  spend: (n: number, memo: string, meta?: any) => boolean;
  refund: (n: number, memo: string, meta?: any) => void;
  grant: (n: number, memo?: string) => void;
};

const storageKey = (uid: string | null) =>
  uid ? `credits:${uid}:v1` : `credits:anon:v1`;

export const useCredits = create<State>((set, get) => ({
  ready: false,
  userId: null,
  credits: 0,
  txns: [],
  init: (userId) => {
    if (typeof window === "undefined") {
      set({ userId, credits: 0, txns: [], ready: true });
      return;
    }

    set({ ready: false });
    const key = storageKey(userId);

    const legacyKey = "credits:v1";
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (legacyRaw && !window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, legacyRaw);
      window.localStorage.removeItem(legacyKey);
    }

    const raw = window.localStorage.getItem(key);
    let credits = 20;
    let txns: CreditTxn[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<State> & {
          txns?: CreditTxn[];
        };
        credits = typeof parsed.credits === "number" ? parsed.credits : 20;
        txns = Array.isArray(parsed.txns) ? parsed.txns : [];
      } catch {
        credits = 20;
        txns = [];
      }
    } else {
      window.localStorage.setItem(key, JSON.stringify({ credits, txns }));
    }

    set({ userId, credits, txns, ready: true });
  },
  canSpend: (n) => get().credits >= n,
  spend: (n, memo, meta) => {
    if (get().credits < n) return false;
    const txn: CreditTxn = {
      id: crypto.randomUUID(),
      at: Date.now(),
      cost: -n,
      memo,
      ...(meta ?? {}),
    };
    const nextCredits = get().credits - n;
    const nextTxns = [...get().txns, txn];
    const key = storageKey(get().userId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key,
        JSON.stringify({ credits: nextCredits, txns: nextTxns }),
      );
    }
    set({ credits: nextCredits, txns: nextTxns });
    return true;
  },
  refund: (n, memo, meta) => {
    const txn: CreditTxn = {
      id: crypto.randomUUID(),
      at: Date.now(),
      cost: n,
      memo,
      ...(meta ?? {}),
    };
    const nextCredits = get().credits + n;
    const nextTxns = [...get().txns, txn];
    const key = storageKey(get().userId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key,
        JSON.stringify({ credits: nextCredits, txns: nextTxns }),
      );
    }
    set({ credits: nextCredits, txns: nextTxns });
  },
  grant: (n, memo = "grant") => {
    const txn: CreditTxn = {
      id: crypto.randomUUID(),
      at: Date.now(),
      cost: n,
      memo,
    };
    const nextCredits = get().credits + n;
    const nextTxns = [...get().txns, txn];
    const key = storageKey(get().userId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key,
        JSON.stringify({ credits: nextCredits, txns: nextTxns }),
      );
    }
    set({ credits: nextCredits, txns: nextTxns });
  },
}));

export const useCreditStore = useCredits;
