// Mock 题库：正式版共 ASSESSMENT_META.totalQuestions 题，这里先放 5 道
// answer 是参考答案，仅供以后计分使用，答题过程中不展示
export const QUESTIONS = [
  {
    id: 'q1',
    dimensionId: 'ai-literacy',
    stem: '在为客服场景设计 AI 助手时，多轮上下文最适合用哪种方案？',
    options: [
      { id: 'a', text: '每一轮都把完整的历史对话原文拼进 Prompt，保证信息不丢失' },
      { id: 'b', text: '保留最近几轮原文，更早的对话压缩成滚动摘要，订单号、诉求等关键信息抽取成结构化字段' },
      { id: 'c', text: '每次对话结束后用对话记录微调模型，让模型记住每位用户' },
      { id: 'd', text: '每轮独立处理不保留上下文，需要时引导用户重新描述问题' },
    ],
    answer: 'b',
  },
  {
    id: 'q2',
    dimensionId: 'scenario',
    stem: '某电商团队想用大模型自动审批退款申请。以下哪个信号最说明：这个场景暂时不适合让模型直接做决定？',
    options: [
      { id: 'a', text: '每天的退款申请量超过 1 万单' },
      { id: 'b', text: '审批规则写在文档里，但有一部分依赖客服的经验判断' },
      { id: 'c', text: '一次错判可能造成较大的资金损失，而流程中没有人工复核环节' },
      { id: 'd', text: '历史审批记录里没有标注拒绝原因' },
    ],
    answer: 'c',
  },
  {
    id: 'q3',
    dimensionId: 'product-design',
    stem: '一款 AI 写作助手生成的内容偶尔会编造数据和出处。在不更换模型的前提下，产品层面最应该优先做什么？',
    options: [
      { id: 'a', text: '在页面底部加一行声明：「AI 生成内容仅供参考」' },
      { id: 'b', text: '生成内容时附上引用来源，用户可以点开核对；找不到可靠来源的数字标记为「待核实」' },
      { id: 'c', text: '限制每次生成的字数，减少模型出错的机会' },
      { id: 'd', text: '把模型的 temperature 参数调到 0' },
    ],
    answer: 'b',
  },
  {
    id: 'q4',
    dimensionId: 'data-eval',
    stem: '你负责的 RAG 知识库问答上线后，用户反馈「答非所问」。要判断问题出在检索还是生成，应该先看哪个指标？',
    options: [
      { id: 'a', text: '回答的平均长度' },
      { id: 'b', text: '检索召回率：正确的文档片段是否出现在检索返回的 Top-K 结果里' },
      { id: 'c', text: '用户对回答的点赞率' },
      { id: 'd', text: '模型返回第一个 Token 的延迟' },
    ],
    answer: 'b',
  },
  {
    id: 'q5',
    dimensionId: 'business',
    stem: 'AI 摘要功能每次调用平均消耗 3,000 输入 Token、500 输出 Token，输出单价是输入的 4 倍。想降低成本，第一步最有效的是？',
    options: [
      { id: 'a', text: '把输出长度从 500 Token 压缩到 300 Token' },
      { id: 'b', text: '对相同文档的摘要结果做缓存，并裁掉输入里与摘要无关的内容' },
      { id: 'c', text: '换成参数更大的模型，减少用户点「重新生成」的次数' },
      { id: 'd', text: '限制每位用户每月最多使用 10 次' },
    ],
    answer: 'b',
  },
];
