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
