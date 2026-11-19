# AI PM Coach

给想转 AI 产品经理的人用的能力诊断工具。当前是 V0.1：落地页 + 测评介绍页 + 答题页占位，纯静态前端。

## 运行

```bash
npm install
npm run dev
```

## 技术栈

React 19 · Vite · Tailwind CSS v4（`@tailwindcss/vite`）· React Router

## 结构

```
src/
  main.jsx              路由：/  /intro  /quiz，其他路径重定向到 /
  index.css             Tailwind 引入 + @theme 色板
  data/assessment.js    测评元信息与 6 个维度（改这里，页面文案跟着变）
  components/           Layout / Button / DimensionCard
  pages/                LandingPage / IntroPage / QuizPage（占位）
```
