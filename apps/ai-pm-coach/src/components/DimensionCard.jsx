export default function DimensionCard({ index, name, desc }) {
  return (
    <li className="rounded-[10px] border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong">
      <span className="text-[13px] font-medium text-muted tabular-nums">
        {String(index).padStart(2, '0')}
      </span>
      <h3 className="mt-2 text-base font-semibold text-ink">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{desc}</p>
    </li>
  )
}
