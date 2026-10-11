# 技术决策记录（ADR）

## D-001 渲染主路径：Remotion + `@remotion/three` + R3F

- **决定**：使用 Remotion 4 作为时间轴与编码器，`@remotion/three` 的 `<ThreeCanvas>` 承载 React Three Fiber 场景。
- **依据**（已读安装包源码 `node_modules/@remotion/three/dist/cjs/ThreeCanvas.js` 验证，而非猜测）：
  渲染时 `<ThreeCanvas>` 强制 `frameloop="never"`，每个 Remotion 帧调用一次 `advance()`，并用 `delayRender/continueRender` 等待 R3F 完成绘制后才截图。
- **推论 / 规则**：所有运动只能是 `useCurrentFrame()` 的纯函数。`useFrame`、`THREE.Clock`、`performance.now()`、`Date.now()`、`Math.random()` 一律禁止，并由 ESLint 规则强制（见 `eslint.config.mjs`）。
- **验证**：最小验证（单帧 still）通过后才继续；无需启用替代渲染路径。

## D-002 WebGL 后端：`swangle`（ANGLE + SwiftShader 软件渲染）

- 容器无 GPU。`Config.setChromiumOpenGlRenderer('swangle')` 让 Chromium 用 CPU 实现 WebGL。
- 好处：同一机器上逐像素可复现（已用解码像素 SHA-256 验证）。
- 代价：比 GPU 慢；不同 CPU/驱动/Chromium 版本之间**不保证**跨机器逐像素一致。黄金哈希只在同一环境内比较。

## D-003 浏览器可执行文件：可配置

- Remotion 默认从 `remotion.media` 下载 Chrome Headless Shell；当前沙箱网络策略阻断该域名。
- `remotion.config.ts` 读取环境变量 `REMOTION_BROWSER_EXECUTABLE`，在离线/CI 环境指向预装的 headless shell。未设置时保持 Remotion 默认行为（自动下载）。
- C001 验收使用的是 Playwright 预装 Chromium Headless Shell 141.0.7390.37。

## D-004 依赖版本：精确锁定、发布 ≥ 2 周

| 包 | 版本 | 说明 |
|---|---|---|
| remotion / @remotion/cli / @remotion/three / @remotion/eslint-config-flat | 4.0.525 | 2026-09-15 发布；所有 @remotion/* 必须同版本 |
| three / @types/three | 0.186.0 | |
| @react-three/fiber | 9.7.0 | v9 需要 React 19（peer `>=19 <19.4`） |
| react / react-dom | 19.2.8 | 19.2 稳定线 |
| typescript | 5.9.3 | |
| eslint | 9.39.4 | Remotion flat config 要求 `>=9` |
| vitest | 3.2.7 | |
| playwright | 1.56.1 | 与容器预装浏览器 build 1194 匹配 |

## D-005 帧图格式与编码

- 中间帧 `png`（无损），编码 `h264` + `yuv420p`（兼容性最广）。
- 确定性比较对象是**解码后的 RGBA 像素**（ffmpeg rawvideo → SHA-256），不比较容器字节，避免元数据差异造成误报。

## D-006 预览验证分两种目标

- `build`：`npm run build` 生成的静态 bundle（只读 Studio），不发起外部请求，要求 0 控制台错误。
- `studio`：实时 `remotion studio`。Studio 外壳会请求 `https://bugs.remotion.dev/api/<version>`（查询已知 bug），沙箱中被阻断，Chromium 会记录一条资源加载错误。Studio 源码已对失败做了容错处理。验证脚本**仅**对这一个 URL 显式标注 `ENV-ALLOWED` 并打印出来，不做静默过滤；其它任何错误都会失败。

## D-007 工程位置

- 仓库根目录是另一个项目（HUMAN → IP → OS）。为避免覆盖，本工程独立放在 `kunlun/mi-topology-life/`，拥有自己的 `package.json` 与锁文件，不修改仓库已有文件。

## D-008 C002 目录结构

- 卡片要求的路径 `src/identity/`、`src/geometry/`、`src/motion/` 与 C001 的分层（内核层 / 表现层 / 镜头层）一致，直接采用。
- C001 的 `src/core/identity.ts`（`MI_IDENTITY`）保留，但改为从 `DEFAULT_MI_SPEC` 派生种子与 (p, q)，保证身份只有一个来源。C001 的渲染代码不改；C001 的确定性哈希必须与已记录值逐位相同（已复核）。
- `src/core/` 保留通用工具（rng、time、topology）。

## D-009 调试网页使用 Vite（不新增依赖下载）

- Remotion 只能打包 Studio 入口，无法生成独立的交互网页。Vite 7.3.7 已作为 vitest 的依赖存在于依赖树中，本卡只把它声明为直接 devDependency 并精确锁定（npm 去重，没有下载新包）。
- 为 `react-dom/client` 的类型声明新增 `@types/react-dom@19.2.7`（仅类型，约 1 个包）。
- 调试页的播放只推进整数帧号（`setInterval`），画面仍是 f(frame, params)，不使用 `useFrame`、Clock 或墙钟时间。

## D-010 性质测试自建 harness，不引入 fast-check

- `tests/support/property.ts` 约 100 行，基于项目已有的 Mulberry32。
- 每个用例的种子由 (baseSeed, 名称, 序号) 派生，所有用例与失败都写入 `out/test-logs/property/*.json`，并支持 `MI_PROPERTY_SEED` 单例复现。卡片要求"记录所有失败种子和参数"，自建 harness 可以完全控制日志格式，也不增加依赖。

## D-011 身份曲线的参数化

- K 采用环面结参数化，与 Three.js `TorusKnotGeometry` 的中心线完全一致（a = R/2），使 C001 网格与 C002 内核共享同一条曲线，并由测试锁定。

## D-012 C003 结构：纯数值层 + 表现层

- `src/film/` 只包含帧号的纯函数（时间轴、相机、Φ(t) 参数、包络、`filmStateAt`），不依赖 React 或 Three.js，900 帧可以在 Node 中全量测试。
- `src/scenes/film/` 与 `src/compositions/MiFilm.tsx` 只负责把状态画出来。
- 身份数据（spec、锚点、Φ、P）全部直接调用 C002 内核。Φ 参数每帧都由 `deformationFromParams` 校验，超出约束即抛错。C002 身份源码保持不变（集成测试用 git 校验）。

## D-013 显式启用 SwiftShader（浏览器启动包装脚本）

- Chrome 141 对隐式的软件 WebGL 回退给出弃用警告，要求加 `--enable-unsafe-swiftshader`。Remotion 4.0.525 只在 v5 的 `angle` 路径中加这个参数，`swangle` 不会加。
- C003 渲染通过 `scripts/chrome-swiftshader.sh` 启动真实浏览器并加上这一个参数。渲染后端仍是 SwiftShader，C001 的渲染管线没有改动。

## D-014 渲染日志严格判定与库通知白名单

- `scripts/film-render.mjs` 收集每一条浏览器消息。任何 error 级消息，或包含 WebGL、GL_INVALID、THREE.、swiftshader 的消息，都会让渲染失败。
- 唯一的白名单是一条**完全匹配**的库通知：`THREE.Clock: This module has been deprecated…`。它来自 @react-three/fiber 9.7.0 在 store 中构造 `THREE.Clock`，与 three 0.186 的组合产生。本工程代码不使用 Clock（lint 禁止）。白名单消息仍会被记录，并以 `LIB-ALLOWED` 输出。升级 R3F 会改变渲染基线，留待单独评估。

## D-015 字幕字体内嵌

- 使用 Noto Serif SC Medium 的子集（Google Fonts `text=` 子集化，TrueType，5.5 KB，SIL OFL 1.1），放在 `public/fonts/`。
- 用 `FontFace` 加载，`delayRender` 等待；加载失败或字形检查失败时调用 `cancelRender`，不允许回退到系统字体。单元测试解析 cmap，证明 14 个字符全部有字形。

## D-016 ACT V 的"同步"不改动 P 协议

- 卡片要求"三锚点依次脉动并同步"。P 协议固定了相位差 [0, 1/3, 2/3]（INV-P1，C002 已冻结），直接让三个锚点同相会破坏不变量。
- **依次**由 P 本身给出：A1、A2、A3 分别在约 27.4 s、28.4 s、29.4 s 达到峰值。**同步**由表现层的共享共振包络实现，三个锚点同相，叠加在 P 之上。测试同时验证 P 原值未变、共振对三锚点完全相同。

## D-017 最终字幕：无字幕画面 + 单层 C004 字幕（不叠加、不改冻结母版）

- 冲突：C003 冻结母版已内嵌字幕，时序为 28.0 s 淡入、28.8 s 完全可见、保持到结尾。C004.5 批准的时序是 28.0 淡入、28.5 完全可见、29.5 淡出、30.0 结束。内嵌字幕无法移除，C004.7 又禁止重复叠加。
- 方案：`renders/mi-visual-master-1080p.mp4` 保持不变，QC 校验 SHA-256。新增 `MI-Final` 合成：用 C003 原有的 `MiFilm` 组件渲染（`captionEnabled=false`，这个开关在 C003 就已存在，只移除 HTML 字幕层），再叠加**一层**按 C004 时序的字幕。文字、字体、版式与 C003 相同，只有不透明度曲线不同。
- 证据（QC）：
  - 28 s 之前的渲染与 C003 合成逐像素相同；
  - 帧 0–839 解码后与冻结母版相比，PSNR 平均 68.4 dB、最低 50.3 dB；
  - 帧 870 与 C003 自带字幕帧逐像素相同，证明只有一层字幕；
  - 9 个字幕时间点实测不透明度与 C004 曲线一致（误差 ≤ 0.006）。
- C003 镜头结构、相机、包络、身份数据均未改动。

## D-018 音频引擎：TypeScript 离线合成，用 vite-node 运行

- 声音是全局时间的确定性函数，直接复用 C002 内核和 C003 包络（同一个 `envelopesAt`、`filmDeformationParams`、`pulseIntensity`），不另建身份协议。
- 用 `vite-node`（vitest 已带入，3.2.4，只是显式声明，没有下载新包）直接运行 TS 源码。
- 没有使用任何外部音乐或音效素材，全部由正弦、窗函数和种子随机数生成。

## D-019 响度测量与母带处理

- 测量工具：ffmpeg `ebur128=peak=true`（BS.1770 / EBU R128，真峰值 4× 过采样）；交叉校验：ffmpeg `loudnorm` 分析器。
- 母带流程：预混 → 测量 → 增益到 −16 LUFS → 5 ms 前视限幅器（天花板 −2 dBFS）→ 复测并修正一次增益 → WAV 和 AAC 的真峰值都必须 ≤ −1 dBTP；否则降低天花板重试。本次限幅器没有动作（真峰值 −5.5 dBTP）。
- STEM 使用与母版相同的增益（限幅器之前），五条相加等于预混。

## D-020 声音与身份脉冲的频率分离

- 三个身份脉冲音高为 660 / 990 / 1320 Hz（1 : q/p : p），音色只加相位锁定的 3 次谐波，避免拍频使峰值偏离 P 时刻。
- 终章和声去掉了比值 3（220 × 3 = 660 Hz，会与 A1 撞频）。单元测试保证所有持续声部与脉冲音高及其 3 次谐波至少相隔 25 Hz。
- 这个问题是 QC 首轮发现的：A1 在 ACT V 的周期测量受到污染。
