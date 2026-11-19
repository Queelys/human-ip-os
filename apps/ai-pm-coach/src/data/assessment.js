export const ASSESSMENT_META = { durationMinutes: 15, completedCount: 1234, totalQuestions: 15 };

// color：六个维度的低饱和配色（蓝、青、绿、橙、紫、粉），用于题目标签、雷达图和结果列表
export const DIMENSIONS = [
  { id: 'ai-literacy',    name: 'AI 技术理解',   color: '#4F6FA5', desc: '理解大模型、RAG、Agent 的能力边界与原理' },
  { id: 'scenario',       name: '场景与需求判断', color: '#357A7A', desc: '判断一个问题是否值得、适合用 AI 解决' },
  { id: 'product-design', name: 'AI 产品设计',   color: '#4E7D52', desc: '为不确定的模型输出设计体验与 Prompt' },
  { id: 'data-eval',      name: '数据与评估',     color: '#A0662F', desc: '构建数据集、评测指标与效果评估体系' },
  { id: 'business',       name: '商业与成本',     color: '#7462A3', desc: '算清 Token 成本、ROI 与定价策略' },
  { id: 'delivery',       name: '落地与协作',     color: '#A0566F', desc: '与算法、工程协作推进迭代，管控风险与合规' },
];

export const DIMENSION_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));
