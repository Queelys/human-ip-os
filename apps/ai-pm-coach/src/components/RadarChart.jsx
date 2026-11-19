import { SCORE_THRESHOLDS, getStatus } from '../data/mockResult.js'

const W = 520
const H = 440
const CX = W / 2
const CY = H / 2
const R = 150
const LEVELS = [20, 40, 60, 80, 100]

const axisStroke = {
  strong: { stroke: 'var(--color-good)', width: 2 },
  weak: { stroke: 'var(--color-warn)', width: 2 },
  normal: { stroke: 'var(--color-border)', width: 1 },
}

function polar(i, n, value) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
  const r = (R * value) / 100
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle), angle]
}

const toPoints = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

// items: [{ id, name, color, score }]，按顺时针从正上方开始排列
export default function RadarChart({ items }) {
  const n = items.length
  const dataPoints = items.map((d, i) => polar(i, n, d.score))
  const summary = items.map((d) => `${d.name} ${d.score} 分`).join('，')

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`能力雷达图：${summary}`}>
        {/* 网格：20 / 40 / 60 / 80 / 100 五圈六边形 */}
        {LEVELS.map((lv) => (
          <polygon
            key={lv}
            points={toPoints(items.map((_, i) => polar(i, n, lv)))}
            fill={lv === 100 ? 'var(--color-card)' : 'none'}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}
        {/* 刻度数字放在第一、二条轴之间的边中点，避开轴上的数据点 */}
        {LEVELS.map((lv) => {
          const r = ((R * lv) / 100) * Math.cos(Math.PI / n)
          const a = -Math.PI / 2 + Math.PI / n
          return (
            <text
              key={lv}
              x={CX + r * Math.cos(a) - 4}
              y={CY + r * Math.sin(a) + 12}
              fontSize={10}
              textAnchor="end"
              fill="var(--color-muted)"
              className="tabular-nums"
            >
              {lv}
            </text>
          )
        })}

        {/* 轴线：≥80 绿色，<60 橙色 */}
        {items.map((d, i) => {
          const [x, y] = polar(i, n, 100)
          const s = axisStroke[getStatus(d.score)]
          return <line key={d.id} x1={CX} y1={CY} x2={x} y2={y} stroke={s.stroke} strokeWidth={s.width} />
        })}

        {/* 得分区域 */}
        <polygon
          points={toPoints(dataPoints)}
          fill="var(--color-primary)"
          fillOpacity={0.1}
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {items.map((d, i) => {
          const [x, y] = dataPoints[i]
          return <circle key={d.id} cx={x} cy={y} r={5.5} fill={d.color} stroke="#ffffff" strokeWidth={2} />
        })}

        {/* 维度标签：名称 + 分数 */}
        {items.map((d, i) => {
          const [, , angle] = polar(i, n, 100)
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const x = CX + (R + 22) * cos
          const y = CY + (R + 22) * sin
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
          const baseY = sin < -0.5 ? y - 22 : sin > 0.5 ? y + 14 : y - 4
          return (
            <text key={d.id} x={x} y={baseY} textAnchor={anchor} fontSize={15}>
              <tspan x={x} fill="var(--color-ink)" fontWeight={600}>
                {d.name}
              </tspan>
              <tspan x={x} dy={20} fill={d.color} fontWeight={600} className="tabular-nums">
                {d.score}
              </tspan>
            </text>
          )
        })}
      </svg>
      <figcaption className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-good" aria-hidden="true" />
          ≥ {SCORE_THRESHOLDS.strong} 优势
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-warn" aria-hidden="true" />
          &lt; {SCORE_THRESHOLDS.weak} 待补
        </span>
      </figcaption>
    </figure>
  )
}
