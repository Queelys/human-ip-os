# ACCEPTANCE — KUNLUN-MI-C002｜MI Identity Kernel V1.0

验收日期：2026-10-10 · 状态：**PASS（已通过人工验收）**

## 前置条件

- C001 验收记录（`ACCEPTANCE.md`）：**PASS，已通过人工验收**，前置条件满足。
- 仓库中没有 `AGENTS.md`（全仓搜索无结果）。已阅读 `package.json` 与 C001 验收记录。

## 复现

```bash
cd kunlun/mi-topology-life
export REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell  # 离线环境
npm install && npm run lint && npm run typecheck && npm run test:log && npm run build
npm run render:test && npm run verify:video && npm run verify:determinism && npm run verify:preview   # C001 回归
npm run verify:debugger && npm run evidence:c002                                                   # C002 调试页
```

以上命令都在**删除 `node_modules`、`build/`、`build-debugger/`、`out/` 后**从零执行，全部退出码为 0。

## 强制验收项

| 项 | 结果 | 证据 |
|---|---|---|
| C001 保持 PASS | ✅ ffprobe 10/10；确定性像素哈希与 C001 记录**逐位相同**（f0 `0717ef3d…`、f45 `9cd03bb4…`、f89 `9844b3bb…`、整片 `eb1c056b…`）；预览 6/6 | 运行日志 |
| lint | ✅ 0 问题 | `npm run lint` |
| typecheck | ✅ 0 错误 | `npm run typecheck` |
| build | ✅ Remotion bundle + 调试网页 bundle | `npm run build` |
| unit tests | ✅ 9 个文件，86/86 通过 | `evidence/c002/vitest.txt`、`vitest.json` |
| property tests | ✅ 8 个性质，共 3,700 个用例，0 失败 | `evidence/c002/property/*.json` |
| 调试网页可以打开 | ✅ 构建版 12/12 检查通过；dev server HTTP 200 | `evidence/c002/debugger/debugger-check.json` |
| 三个锚点在所有测试帧中可追踪 | ✅ 全片 900 帧；逆映射最大误差 3.3e-15；锚点间最小距离 2.868 | `evidence/c002/anchor-tracking.json` |
| 允许形变符合既定数学约束 | ✅ 900 帧参数均在 Φ 约束内；Jacobian 行列式 > 0；越界参数被拒绝 | deformation / property 测试 |
| 可核验的测试日志与截图 | ✅ | `docs/evidence/c002/` |

## C002.8 测试覆盖对照

| 要求 | 测试 |
|---|---|
| 1 固定种子确定性 | `rng.test`；`neuralGraph.test` "reproducible from the seed"；`identity.test` 指纹快照 |
| 2 锚点身份稳定性 | `identity.test` "C002.3 anchor identity stability"；`deformation.test` 900 帧追踪；性质 `anchor-recovery` |
| 3 核心图关系不变 | `identity.test` "G is the labelled K3" 与签名不变测试；`neuralGraph.test` 外围生成前后比对 |
| 4 曲线闭合与切向连续 | `trefoil.test` "curve closure and tangent continuity"（5 项） |
| 5 变换逆映射精度 | `deformation.test` 各原语与复合；性质 `inverse-identity`、`inverse-identity-compositions` |
| 6 采样几何安全检查 | `trefoil.test` "sampling geometry safety"；性质 `knot-geometry` |
| 7 脉冲相位一致性 | `pulse.test`（5 项）；性质 `pulse-phase` |
| 8 类型检查与构建 | `npm run typecheck`、`npm run build` |
| 合法参数随机抽样 | 性质 `legal-params`、`orientation`、`motion-time` |
| 正比例缩放始终 > 0 | 性质 `legal-params`、`inverse-identity-compositions`、`motion-time`；`uniformScale` 拒绝 ≤ 0 |
| 变换与逆变换复合 ≈ 恒等 | 性质 `inverse-identity`（双向）、`inverse-identity-compositions`（1–8 个原语的随机链） |
| 记录失败种子与参数、支持复现 | `tests/support/property.ts`；性质 `harness` 自测：用记录的种子通过 `MI_PROPERTY_SEED` 复现出相同输入与错误；`_selftest-expected-failures.json` 是**有意失败**的样例报告（13/50），不是真实失败 |

## 性质测试报告（baseSeed = 3221356545 = 0xC0020001）

| 性质 | 用例 | 通过 | 失败 |
|---|---|---|---|
| legal-params | 500 | 500 | 0 |
| inverse-identity | 500 | 500 | 0 |
| inverse-identity-compositions | 500 | 500 | 0 |
| orientation | 500 | 500 | 0 |
| anchor-recovery | 500 | 500 | 0 |
| motion-time | 500 | 500 | 0 |
| pulse-phase | 500 | 500 | 0 |
| knot-geometry | 200 | 200 | 0 |

复现单个用例：`MI_PROPERTY_SEED=<caseSeed> npx vitest run tests/property.test.ts -t "<名称>"`。换一批随机用例：`MI_PROPERTY_BASE_SEED=<uint32> npm test`。

## 调试网页检查（`npm run verify:debugger`）

用 Playwright 操作**真实界面控件**（数字输入框、复选框、Reset 按钮），然后读取页面状态，与 Node 端内核写出的期望值（`debugger-expected.json`）比较：

```
PASS  page loads + WebGL canvas
PASS  shows identity version             1.0.0
PASS  shows seed                         0x4B4C4D49
PASS  shows fingerprint                  cd2e236379d37be5
PASS  case default: anchors = kernel     frame 0,   max|Δ| 2.2e-16, inv 0.0e+0
PASS  case manual: anchors = kernel      frame 123, max|Δ| 4.4e-16, inv 5.6e-16
PASS  case motion-f150: anchors = kernel frame 150, max|Δ| 2.2e-16, inv 1.8e-15
PASS  case motion-f450: anchors = kernel frame 450, max|Δ| 2.2e-16, inv 2.3e-16
PASS  case motion-f899: anchors = kernel frame 899, max|Δ| 2.2e-16, inv 4.4e-16
PASS  scale=5 flagged outside Φ          paramsValid=false
PASS  reset restores defaults            {"frame":0,"followMotion":false,"params":{yaw:0,pitch:0,roll:0,scale:1,twist:0}}
PASS  no console/page errors             0 errors
```

截图：`docs/evidence/c002/debugger/{default,manual,motion-f150,motion-f450,motion-f899,constraint-violation,after-reset}.png`。截图只用于人工查看，身份一致性由上面的数值比对判定，不依赖视觉相似。

## 数学保证与数值检查的边界

见 `docs/MI_MATH_RULES.md`。嵌入性、纽结类型、手性保持和逆映射存在性由 §1–§6 的证明给出。测试是浮点实现的数值检查，**不构成严格拓扑证明**。

## 已知风险

1. **管道厚度 vs 链间距**：K 是零厚度曲线。实测非相邻链最小距离：未形变 0.869；最大扭转 0.676；缩放 0.25 加最大扭转 0.169。C001 测试网格的管道半径为 0.32，直径 0.64 接近 0.676。将来如果把 Φ 施加到 C001 网格上，管道在视觉上可能自相交（身份曲线本身不会）。表现层的管道半径应 ≤ 0.3 × 链间距 × 缩放。
2. **Φ 约束是工程选择**：缩放 [0.25, 3] 和 \|扭转\| ≤ π/2 不是拓扑必需（任何 s > 0、任何有限 k 都保持同痕类），只是为了数值与观感安全。
3. **跨引擎 1 ulp 差异**：浏览器与 Node 计算的锚点相差 ≤ 4.4e-16，所以比较容差为 1e-9。像素级跨机一致性仍不保证（C001 D-002）。
4. **调试网页播放**用 `setInterval` 推进帧号，真实帧率受浏览器影响；画面仍然只由帧号决定。
5. **开发依赖安全公告**（C001 已知，未变化）：运行时依赖 0 条。

## 人工验收记录

- 2026-10-10：C002 通过人工验收。
- 确认锚点标签：A1「骨 Structure」、A2「脉 Signal」、A3「息 Breath」；核心边 E12「成形 form」、E23「传导 conduct」、E31「回归 return」。
- 确认脉冲参数：周期 3 s，宽度 0.25，相位偏移 [0, 1/3, 2/3]。
- 确认 Φ 边界：缩放 [0.25, 3]，|扭转| ≤ π/2 rad/单位 z。
- 身份规范 V1.0（指纹 `cd2e236379d37be5`）冻结为后续卡片的基线；变更须按 MI_IDENTITY_SPEC §6 流程进行。
