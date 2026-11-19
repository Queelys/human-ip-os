export default function ProgressBar({ current, total }) {
  const percent = Math.min(100, (current / total) * 100)
  return (
    <div>
      <p className="text-sm text-muted tabular-nums">
        第 <span className="font-semibold text-ink">{current}</span> 题 / 共 {total} 题
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label="答题进度"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
