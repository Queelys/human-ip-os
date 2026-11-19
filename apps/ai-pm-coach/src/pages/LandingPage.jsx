import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import { ASSESSMENT_META, DIMENSIONS } from '../data/assessment.js'

export default function LandingPage() {
  const { durationMinutes, completedCount } = ASSESSMENT_META

  return (
    <Layout
      footer={<p className="text-[13px] text-muted">已有 {completedCount} 人完成测评</p>}
    >
      <section className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight text-ink sm:text-5xl">
          测出你的 AI PM 能力短板
        </h1>
        <p className="mt-4 text-lg text-muted sm:text-xl">
          {durationMinutes} 分钟，{DIMENSIONS.length} 个维度，告诉你该补什么
        </p>
        <Button to="/intro" size="lg" className="mt-10">
          开始测评
        </Button>
      </section>
    </Layout>
  )
}
