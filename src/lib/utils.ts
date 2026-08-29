import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 10000) {
    const man = value / 10000
    // 1,000万円を超えると小数第1位は1,000円単位の情報でしかなく、
    // 「6900.0万円」のように桁が読み取りにくくなる。整数に丸めて桁区切りを入れる
    if (Math.abs(man) >= 1000) {
      return `${Math.round(man).toLocaleString()}万円`
    }
    return `${man.toFixed(1)}万円`
  }
  // 分単価や人時生産性など1万円未満の指標は小数が出るため円単位に丸める
  return `${Math.round(value).toLocaleString()}円`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  // FTEや1日平均来院数など小数を持つ指標があるため、小数第1位までに丸める。
  // 患者数などの整数はそのまま整数で表示される。
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
