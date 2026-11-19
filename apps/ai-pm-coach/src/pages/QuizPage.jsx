import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/Button.jsx'
import Layout, { focusRing } from '../components/Layout.jsx'
import OptionCard from '../components/OptionCard.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { ASSESSMENT_META, DIMENSION_BY_ID } from '../data/assessment.js'
import { QUESTIONS } from '../data/questions.js'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function QuizPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState({})
  const stemRef = useRef(null)

  const question = QUESTIONS[index]
  const dimension = DIMENSION_BY_ID[question.dimensionId]
  const isLast = index === QUESTIONS.length - 1

  // 换题后把焦点移到题干，方便键盘和读屏用户从新题开始
  useEffect(() => {
    if (index > 0) stemRef.current?.focus()
  }, [index])

  // answer 为 null 表示跳过；答题过程中不展示对错
  function advance(answer) {
    const next = { ...answers, [question.id]: answer }
    setAnswers(next)
    if (isLast) {
      navigate('/result', { state: { answers: next } })
      return
    }
    setIndex(index + 1)
    setSelected(null)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[720px] pt-4 pb-20 sm:pt-8">
        <ProgressBar current={index + 1} total={ASSESSMENT_META.totalQuestions} />

        <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-8">
          <p className="text-[13px] font-medium tabular-nums">
            <span className="text-muted">#{index + 1}</span>
            <span className="text-muted"> · </span>
            <span style={{ color: dimension.color }}>{dimension.name}</span>
          </p>
          <h1
            id="question-stem"
            ref={stemRef}
            tabIndex={-1}
            className="mt-3 text-lg leading-[1.6] font-semibold text-ink outline-none sm:text-xl"
          >
            {question.stem}
          </h1>

          <div role="radiogroup" aria-labelledby="question-stem" className="mt-6 flex flex-col gap-3">
            {question.options.map((opt, i) => (
              <OptionCard
                key={opt.id}
                name={question.id}
                letter={LETTERS[i]}
                text={opt.text}
                value={opt.id}
                checked={selected === opt.id}
                onSelect={setSelected}
              />
            ))}
          </div>
        </section>

        <div className="mt-6 flex items-center justify-end gap-5">
          <button
            type="button"
            onClick={() => advance(null)}
            className={`rounded-sm text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline ${focusRing}`}
          >
            跳过本题
          </button>
          <Button onClick={() => advance(selected)} disabled={selected === null}>
            {isLast ? '查看结果' : '下一题'}
          </Button>
        </div>
      </div>
    </Layout>
  )
}
