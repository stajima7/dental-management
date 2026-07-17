import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}万円`
  }
  return `${value.toLocaleString()}円`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  // FTEや1日平均来院数など小数を持つ指標があるため、小数第1位までに丸める。
  // 患者数などの整数はそのまま整数で表示される。
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
