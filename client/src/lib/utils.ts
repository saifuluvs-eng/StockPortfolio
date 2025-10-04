import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const asArray = (x: any) =>
  Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []

export const asString = (v: any) => (v ?? "").toString()
