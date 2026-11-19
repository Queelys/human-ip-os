import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import RadarChart from '../components/RadarChart.jsx'
import { DIMENSIONS } from '../data/assessment.js'
import { MOCK_RESULT, getLevel, getStatus } from '../data/mockResult.js'

const statusTag = {
  strong: { label: '优势', className: 'bg-good-soft text-good' },
  weak: { label: '待补', className: 'bg-warn-soft text-warn' },
}

export default function ResultPage() {
  const items = DIMENSIONS.map((d) => ({ ...d, ...MOCK_RESULT[d.id] }))
  const total = Math.round(items.reduce((sum, d) => sum + d.score, 0) / items.length)
  const strongest = items.reduce((a, b) => (b.score > a.score ? b : a))
  const weakest = items.reduce((a, b) => (b.score < a.score ? b : a))

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1080px] pt-4 pb-20 sm:pt-8">
        <header className="border-b border-border pb-8">
          <p className="text-sm text-muted">你的 AI PM 综合能力</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl font-bold tracking-tight text-ink tabular-nums">{total}</span>
            <span className="text-xl font-semibold text-ink">分 · {getLevel(total)}</span>
          </p>
          <p className="mt-3 text-base text-muted">
            {strongest.name}是你的优势，{weakest.name}是目前最需要补的一环。
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <RadarChart items={items} />
          </div>

          <ul className="divide-y divide-border">
            {items.map((d) => {
              const tag = statusTag[getStatus(d.score)]
              return (
                <li key={d.id} className="py-5 first:pt-0">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} aria-hidden="true" />
                    <h2 className="text-base font-semibold text-ink">{d.name}</h2>
                    {tag && (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tag.className}`}>{tag.label}</span>
                    )}
                    <span className="ml-auto text-base font-semibold text-ink tabular-nums">{d.score}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{d.diagnosis}</p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-12 flex justify-center border-t border-border pt-10">
          {/* 学习计划下一版再做，暂时点击无反应 */}
          <Button size="lg">开始你的学习计划</Button>
        </div>
      </div>
    </Layout>
  )
}
