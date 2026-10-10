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
