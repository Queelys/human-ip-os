# 《弥：拓扑生命》 Mi: Topological Life

《昆仑协议》实验短片 · 30 秒 · 1920×1080 · 30 fps · 16:9

程序化、确定性、逐帧可重复渲染的科幻动画工程。弥（Mi）不是人形角色，而是由拓扑结构、神经网络与星系式粒子构成的数字生命体。

> 当前阶段：**C001 — 工程初始化与渲染链路验证**。只有一个 3 秒测试合成 `C001-RenderTest`。

## 技术栈

TypeScript · React 19 · Three.js · React Three Fiber · Remotion 4 · FFmpeg · Playwright · Vitest · ESLint

## 快速开始

```bash
cd kunlun/mi-topology-life
npm install

# 离线 / 沙箱环境：Remotion 无法下载自带 Chrome 时，指定预装的 headless shell
export REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell

npm run preview          # Remotion Studio 浏览器预览（默认 http://localhost:3000）
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run preview` | 启动 Remotion Studio 预览 |
| `npm run lint` | ESLint（含确定性规则：禁用 `Math.random`/`Date.now`/`performance.now`/`useFrame`/`new Date`/`THREE.Clock`） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest 单元测试（种子随机、帧时间、身份内核、拓扑不变量） |
| `npm run build` | 生成静态 Studio bundle 到 `build/` |
| `npm run check` | lint + typecheck + test + build |
| `npm run render:test` | 渲染 `out/c001-render-test.mp4`（3 s / 90 帧） |
| `npm run verify:video` | ffprobe 核对尺寸、帧率、帧数、时长、编码 |
| `npm run verify:determinism` | 同一帧在独立进程、不同顺序下重复渲染，比较像素哈希；并整片重渲比较 |
| `npm run verify:preview` | Playwright 打开 build 与 Studio 预览，检查 WebGL 与控制台错误 |

完整验收流程见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 目录结构

```text
kunlun/mi-topology-life/
├── README.md / FILM_BIBLE.md / SHOT_LIST.md / ACCEPTANCE.md
├── docs/DECISIONS.md        技术决策记录
├── remotion.config.ts       渲染配置（swangle WebGL、png 帧、h264）
├── eslint.config.mjs        含确定性守卫规则
├── src/
│   ├── index.ts / Root.tsx  Remotion 入口与合成注册
│   ├── config/film.ts       全片规格（唯一来源）
│   ├── core/                身份内核层：纯数据 + 纯函数，无 React、无镜头逻辑
│   │   ├── identity.ts      弥的身份内核与拓扑不变量（冻结对象）
│   │   ├── geometry.ts      由内核派生的几何（只依赖内核与种子）
│   │   ├── topology.ts      欧拉示性数校验
│   │   ├── rng.ts           Mulberry32 种子随机 + 标签派生子种子
│   │   └── time.ts          帧 → 时间 / 循环相位
│   ├── scenes/              表现层：读取内核，按帧号生成画面
│   └── compositions/        镜头 / 合成层
├── tests/                   Vitest
├── scripts/                 验证脚本（ffprobe、确定性、预览）
└── out/ build/              产物（git 忽略）
```

## 架构原则

1. **身份内核与表现层解耦**：`src/core` 不依赖 React/镜头；镜头只能读内核，不能改。
2. **帧号是唯一时钟**：任何画面 = f(frame, kernel, seed)。
3. **固定种子**：所有随机经 `createRng(seed, label)`，不同子系统用不同 label 派生独立流。
4. **拓扑不变量受测试保护**：几何改动若破坏 χ = 2 − 2g，`npm test` 失败。
5. V1 不调用任何付费视频生成 API。
