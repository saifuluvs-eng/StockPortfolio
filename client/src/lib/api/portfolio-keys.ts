const NO_USER_KEY = "__no_user__" as const;

export function portfolioPositionsQueryKey(userId: string | null | undefined) {
  return ["portfolio", "positions", userId ?? NO_USER_KEY] as const;
}

export { NO_USER_KEY as __NO_USER_KEY__ };
