import { Link } from 'react-router'
import Button from '../components/Button.jsx'
import DimensionCard from '../components/DimensionCard.jsx'
import Layout, { focusRing } from '../components/Layout.jsx'
import { ASSESSMENT_META, DIMENSIONS } from '../data/assessment.js'

export default function IntroPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-[720px] pt-6 pb-20 sm:pt-10">
        <Link
          to="/"
          className={`rounded-sm text-sm text-muted transition-colors hover:text-ink ${focusRing}`}
        >
          ← 返回
        </Link>

        <h1 className="mt-8 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
          测评会考什么
        </h1>
        <p className="mt-3 text-base text-muted">
          我们会从以下 {DIMENSIONS.length} 个维度评估你的 AI PM 能力
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {DIMENSIONS.map((d, i) => (
            <DimensionCard key={d.id} index={i + 1} name={d.name} desc={d.desc} />
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-5 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            预计用时约 {ASSESSMENT_META.durationMinutes} 分钟 · 共 {DIMENSIONS.length} 个维度
          </p>
          <Button to="/quiz" className="w-full sm:w-auto">
            开始
          </Button>
        </div>
      </div>
    </Layout>
  )
}
