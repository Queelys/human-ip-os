// 单选选项：用原生 radio 保证键盘（Tab / 方向键）和读屏可用，外观由 label 卡片承担
export default function OptionCard({ name, letter, text, value, checked, onSelect }) {
  return (
    <label
      className={
        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors duration-150 ' +
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary ' +
        (checked ? 'border-primary bg-primary-soft' : 'border-border bg-white hover:border-primary')
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={
          'mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150 ' +
          (checked ? 'border-primary bg-primary text-white' : 'border-border text-muted')
        }
      >
        {letter}
      </span>
      <span className="text-[15px] leading-relaxed text-ink">{text}</span>
    </label>
  )
}
