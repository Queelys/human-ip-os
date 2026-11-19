import { Link } from 'react-router'
import Layout, { focusRing } from '../components/Layout.jsx'

export default function QuizPage() {
  return (
    <Layout>
      <section className="flex flex-1 flex-col items-center justify-center gap-4 pb-16 text-center">
        <p className="text-base text-muted">答题页开发中</p>
        <Link
          to="/"
          className={`rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
        >
          返回首页
        </Link>
      </section>
    </Layout>
  )
}
