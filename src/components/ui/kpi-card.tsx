import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  status?: 'positive' | 'warning' | 'critical' | 'neutral'
  change?: { value: number; label: string }
  target?: string
  /** 「一般的な目安 20%」— 判断の基準を示す */
  benchmarkLabel?: string | null
  /** 「目安より高い（良い）」— 色だけでは伝わらない良し悪しを言葉にする */
  verdict?: string | null
  /** 「先月より38万円増えました」— 増減を言葉で */
  changeText?: string | null
}

export function KpiCard({
  label, value, sub, status = 'neutral', change, target,
  benchmarkLabel, verdict, changeText,
}: KpiCardProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-white p-5 shadow-sm relative overflow-hidden",
    )}>
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        status === 'positive' && 'bg-green-500',
        status === 'warning' && 'bg-amber-500',
        status === 'critical' && 'bg-red-500',
        status === 'neutral' && 'bg-blue-500',
      )} />
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      {/* 色だけでは良し悪しが伝わらないため、基準と判定を文字でも示す */}
      {benchmarkLabel && (
        <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          {benchmarkLabel}
          {verdict && (
            <>
              {" → "}
              <span className={cn(
                "font-bold",
                status === 'positive' && 'text-green-700',
                status === 'warning' && 'text-amber-700',
                status === 'critical' && 'text-red-700',
                status === 'neutral' && 'text-gray-700',
              )}>{verdict}</span>
            </>
          )}
        </div>
      )}
      {changeText && <div className="text-xs text-gray-400 mt-1">{changeText}</div>}
      {target && <div className="text-xs text-blue-600 mt-1">目標: {target}</div>}
      {change && (
        <div className={cn(
          "text-xs font-semibold mt-1",
          change.value >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {change.value >= 0 ? '↑' : '↓'} {Math.abs(change.value).toFixed(1)}% {change.label}
        </div>
      )}
    </div>
  )
}
