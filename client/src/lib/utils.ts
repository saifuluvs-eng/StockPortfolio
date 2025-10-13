import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const asArray = <T>(input: unknown): T[] => {
  if (Array.isArray(input)) {
    return input as T[]
  }

  if (input && typeof input === "object") {
    const data = (input as { data?: unknown }).data
    if (Array.isArray(data)) {
      return data as T[]
    }
  }

  return []
}

export const asString = (v: any) => (v ?? "").toString()

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function fmt(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0

  if (!Number.isFinite(numericValue)) {
    return currencyFormatter.format(0)
  }

  return currencyFormatter.format(numericValue)
}
