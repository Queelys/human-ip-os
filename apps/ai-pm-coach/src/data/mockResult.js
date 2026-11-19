// Mock 测评结果：这一版结果页固定展示这份数据，下一版改为根据答题计算
export const MOCK_RESULT = {
  'ai-literacy': {
    score: 85,
    diagnosis:
      '你对大模型选型的判断扎实，能说清 RAG、微调和长上下文各自适合什么场景。短板在 Agent 的失败处理：工具调用出错或陷入循环时怎么兜底，你的回答还停留在概念层面。',
  },
  scenario: {
    score: 72,
    diagnosis:
      '你能识别出高频、规则清晰的环节适合用 AI 提效。但你对错误代价的权衡偏弱：在退款审批这类错一次就损失真金白银的场景里，你倾向于让模型直接决策，没有设计人工复核。',
  },
  'product-design': {
    score: 65,
    diagnosis:
      '你知道要为不确定的输出做设计，会想到加载状态和「重新生成」。处理幻觉时你更依赖免责声明，较少用引用溯源、待核实标记这类让用户自己能核对的手段。',
  },
  'data-eval': {
    score: 45,
    diagnosis:
      '这是你目前最大的短板。遇到「答非所问」时，你没有先拆开看是检索还是生成出了问题，而是盯着点赞率这类结果指标。建议先补召回率、准确率的含义，以及怎么搭一套人工评测集。',
  },
  business: {
    score: 58,
    diagnosis:
      '你知道 Token 有成本，但还算不清成本结构。输入 Token 占大头时，你优先压缩输出长度，省下的钱有限；缓存和裁剪输入这两个更有效的手段需要补上。',
  },
  delivery: {
    score: 70,
    diagnosis:
      '你清楚和算法团队合作要先对齐评测标准，需求文档里也会写边界情况。灰度上线和效果回滚的经验不足：你的上线计划里没有写明指标跌到多少就停止放量。',
  },
};

export const SCORE_THRESHOLDS = { strong: 80, weak: 60 };

export function getLevel(score) {
  if (score >= 80) return '高级水平';
  if (score >= 60) return '中级水平';
  return '入门水平';
}

export function getStatus(score) {
  if (score >= SCORE_THRESHOLDS.strong) return 'strong';
  if (score < SCORE_THRESHOLDS.weak) return 'weak';
  return 'normal';
}
