# ACCEPTANCE — KUNLUN-MI-C003｜五幕电影化制作

验收日期：2026-10-11 · 状态：**PASS（已通过人工验收）**

## 前置条件

| 项 | 结果 |
|---|---|
| AGENTS.md | 仓库中不存在（全仓搜索无结果） |
| package.json | 已读 |
| docs/MI_IDENTITY_SPEC.md、MI_MATH_RULES.md、C002_ACCEPTANCE.md | 已读：C002 为 PASS，已通过人工验收，身份指纹 `cd2e236379d37be5` |
| C001 实际测试日志 | `evidence/c003/prior/c001-acceptance-run.log`：21 项 PASS，0 FAIL |
| C002 实际测试日志 | `evidence/c003/prior/c002-acceptance-run.log`：33 项 PASS，0 FAIL，86/86 测试 |

两个前置关卡都是 PASS，因此进入 C003。

## 复现

```bash
cd kunlun/mi-topology-life
REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell npm run acceptance:c003
```

脚本会先删除 `node_modules`、`build/`、`build-debugger/`、`out/`、`renders/`，再从零执行全部 17 个步骤。完整日志在 `evidence/c003/acceptance-c003.log`。

## 运行结果（真实日志摘录）

```
EXIT 0 :: npm install
EXIT 0 :: npm run lint
EXIT 0 :: npm run typecheck
EXIT 0 :: npm run test:log                 ← 单元测试：15 个文件，120/120
EXIT 0 :: npm run build
EXIT 0 :: npm run test:integration         ← 集成测试 5/5
EXIT 0 :: npm run render:test              ← C001 回归
EXIT 0 :: npm run verify:video             ← C001 ffprobe 10/10
EXIT 0 :: npm run verify:determinism       ← C001 哈希与基线逐位相同
EXIT 0 :: npm run verify:preview           ← C001 预览 6/6
EXIT 0 :: npm run verify:debugger          ← C002 调试页 12/12
EXIT 0 :: npm run render:film:preview      ← 540p，error/WebGL 消息 0
EXIT 0 :: npm run render:film:master       ← 1080p，error/WebGL 消息 0
EXIT 0 :: npm run verify:film:video        ← ffprobe 22/22
EXIT 0 :: npm run verify:film              ← 渲染冒烟 20/20
EXIT 0 :: npm run render:contact-sheet
EXIT 0 :: node scripts/collect-evidence-c003.mjs
ACCEPTANCE PASS
```

全日志共 80 项 PASS，0 项 FAIL。

## C003.8 测试项对照

| 要求 | 证据 | 结果 |
|---|---|---|
| 总帧数严格为 900 | `timeline.test`；bundle 合成参数（集成测试）；ffprobe 两个成片都为 900 帧 | ✅ |
| 帧区间无遗漏、无重叠 | `timeline.test`：每帧恰好属于一幕；校验器能检出缺口、重叠和覆盖不足 | ✅ |
| 相同帧重复渲染一致 | `verify:film`：8 帧在独立进程中逆序重渲，解码像素 SHA-256 完全相同 | ✅ |
| 身份内核配置未被修改 | `identity.film.test`：`FILM_SPEC === DEFAULT_MI_SPEC`，指纹 `cd2e236379d37be5`，全片计算前后序列化逐字节相同；集成测试：身份源码相对 C002 验收提交 `4ec5e9f` 无改动 | ✅ |
| 三锚点在身份数据中始终存在 | 900 帧都是 A1/A2/A3，s 等于 spec，位置严格等于 Φ(K(s)) 和内核 `anchorStates`；P 原值未改 | ✅ |
| 主结拓扑符合 C002 形变约束 | 900 帧 Φ 参数都在约束内，原语只有 twist/scale/rotation；Jacobian 行列式 > 0；逆映射误差 ≤ 1.24e-15；曲线闭合；最小链间距 0.622 ≥ 管道半径 0.035 / 0.3 | ✅ |
| 摄影机运动没有意外跳变 | `camera.test`：最大位移 0.0748/帧（上限 0.1），视线角 0.400°/帧（0.5°），视角 0.041°/帧（0.1°），加速度 0.0026（0.004）；幕边界处相机静止 | ✅ |
| 没有 WebGL 报错 | 每一帧渲染都收集浏览器消息：预览、母版、26 张静帧均为 0 条 error/WebGL；Studio 预览 0 条 | ✅ |
| 没有 NaN、Infinity 或无效几何 | 900 帧状态深度扫描全部有限；alpha 和强度都在 [0,1]；弧长 ≥ 0 | ✅ |
| 字幕正确显示 | 字体 cmap 覆盖全部 14 个字符；像素差分：f830/f840 为 0 px，f846 起可见，包围盒 x535–1353、y864–925，在标题安全区 [96,1824]×[54,1026] 内且居中 | ✅ |
| 1080p 输出参数正确 | ffprobe：1920×1080、30/1、900 帧、30.000000 s、h264、yuv420p、无音轨 | ✅ |

## 交付物

| 文件 | 规格 | 大小 | SHA-256 |
|---|---|---|---|
| `renders/mi-visual-master-1080p.mp4` | 1920×1080 · 30 fps · 900 帧 · 30.000 s · h264/yuv420p · CRF 18 · 无声 | 19.2 MB | `62d80fb0…5599c5` |
| `renders/mi-preview-540p.mp4` | 960×540 · 30 fps · 900 帧 · 30.000 s · 无声 | 6.0 MB | `c795d640…bd8147` |
| `renders/mi-storyboard-contact-sheet.png` | 5 幕 × 首帧/代表帧/末帧，1920×1800 | 1.3 MB | `a5405e88…5b9731` |

三个文件都由本次从零运行实际渲染生成，没有占位文件。

## 过渡验证（C003.5）

四个边界都是**连续过渡**，没有硬切。下表中 Δ 为相邻帧平均像素差（0–255）：

| 边界 | 前 | 跨边界 | 后 |
|---|---|---|---|
| I→II @150 | 0.000 | 0.000 | 0.000 |
| II→III @330 | 0.249 | 0.252 | 0.270 |
| III→IV @540 | 1.762 | 1.745 | 1.795 |
| IV→V @750 | 2.150 | 2.155 | 2.179 |

数值层同时验证：所有包络每帧变化 ≤ 0.1，Φ 参数每帧变化 ≤ 0.05，锚点每帧位移 ≤ 0.08。I→II 的帧差为 0 是因为该处机位静止、画面稳定（A1 已显现，A2 尚未开始渐入）。

## 已知风险

1. **ACT V "同步"的解释**：P 协议固定了相位差，直接同相会破坏 INV-P1。现实现为"依次"由 P 给出（A1、A2、A3 分别在约 27.4、28.4、29.4 s 达到峰值），"同步"由表现层共享共振包络实现（D-016）。若导演要求真正同相脉冲，需要变更身份规范，须人工批准。
2. **库通知白名单**：R3F 9.7.0 + three 0.186 每个渲染标签页输出一条 `THREE.Clock` 弃用通知（每次渲染 3 条）。它已记录，以 `LIB-ALLOWED` 输出，不属于 WebGL 错误（D-014）。
3. **SwiftShader 显式启用**：通过启动包装脚本加入 `--enable-unsafe-swiftshader`（D-013）。像素一致性只保证在同一机器、同一 Chromium 版本内。
4. **Studio 预览外网请求**：沿用 C001 的环境项（`bugs.remotion.dev` 被沙箱阻断，显式标注 ENV-ALLOWED）。
5. **ACT IV 视觉**：大幅扭转时三叶结的投影会出现小环，这是正常投影，不是自交。数值上最小链间距为 0.622。
6. **成片纳入 git**：交付物共约 26 MB，直接提交到分支。如需改用 Git LFS 或外部存储，请告知。

## 人工验收记录

- 2026-10-11：C003 通过人工验收。
- 确认 ACT V「依次脉动并同步」的实现：依次由 P 协议给出（A1→A2→A3），同步为表现层共享共振包络，P 协议与身份规范 V1.0 保持不变（D-016）。
- 确认视觉风格：深空背景、冷青色主结与加色辉光、锚点配色（A1 金 / A2 薄荷 / A3 玫瑰），以及字幕排版（Noto Serif SC Medium，54 px，标题安全区内居中）。
- 交付物 `renders/mi-visual-master-1080p.mp4`（SHA-256 `62d80fb0…5599c5`）冻结为 30 秒无声视觉母版基线。
