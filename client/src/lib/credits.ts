export const COST = {
  TECH: 2,
  AI: 5,
} as const;

export async function spendGuard<T>(
  can: (n: number) => boolean,
  spend: (n: number, memo: string, meta?: any) => boolean,
  refund: (n: number, memo: string, meta?: any) => void,
  cost: number,
  memo: string,
  run: () => Promise<T>,
  meta?: any,
): Promise<T | null> {
  if (!can(cost)) return null;
  if (!spend(cost, memo, meta)) return null;
  try {
    return await run();
  } catch (error) {
    refund(cost, `${memo}:refund`, meta);
    throw error;
  }
}
