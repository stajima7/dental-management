import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  status?: 'positive' | 'warning' | 'critical' | 'neutral'
  change?: { value: number; label: string }
  target?: string
}

export function KpiCard({ label, value, sub, status = 'neutral', change, target }: KpiCardProps) {
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
