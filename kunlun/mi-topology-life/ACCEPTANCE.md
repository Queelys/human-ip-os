# ACCEPTANCE — KUNLUN-MI-C001

卡片：**C001 工程初始化与渲染链路验证**
验收日期：2026-10-10 · 状态：**PASS（待人工验收）**

## 验收环境

| 项 | 版本 |
|---|---|
| Node.js / npm | v22.22.0 / 10.9.4 |
| Git | 2.43.0 |
| FFmpeg / ffprobe | 6.1.1-3ubuntu5 |
| Claude Code | 2.1.296 |
| 渲染浏览器 | Chromium Headless Shell 141.0.7390.37（`REMOTION_BROWSER_EXECUTABLE`） |
| WebGL | `swangle`（ANGLE + SwiftShader，CPU） |

## 复现步骤

```bash
cd kunlun/mi-topology-life
export REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell  # 离线环境需要
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run render:test
npm run verify:video
npm run verify:determinism
npm run verify:preview
```

## 验收项

| # | 要求 | 命令 | 结果 |
|---|---|---|---|
| A1 | npm install 成功 | `npm install` | ✅ 退出码 0；419 包 |
| A2 | lint 通过 | `npm run lint` | ✅ 0 问题（含确定性守卫规则） |
| A3 | typecheck 通过 | `npm run typecheck` | ✅ `tsc --noEmit` 0 错误 |
| A4 | 最小化测试 | `npm test` | ✅ 3 文件 / 9 用例通过（种子随机、帧时间、身份内核、χ=0 拓扑不变量） |
| A5 | build 通过 | `npm run build` | ✅ 静态 bundle 输出到 `build/` |
| A6 | 网页可正常预览 | `npm run verify:preview` | ✅ build 预览与实时 Studio 均加载，WebGL canvas 1920×1080 |
| A7 | 无浏览器控制台错误 | `npm run verify:preview` | ✅ build：0 错误；Studio：0 错误，另有 1 条显式标注的环境项（见下） |
| A8 | 同一帧重复渲染一致 | `npm run verify:determinism` | ✅ 帧 0/45/89 在独立进程、正序与倒序中像素哈希一致；整片 MP4 重渲 90 帧解码哈希一致 |
| A9 | 输出测试 MP4 | `npm run render:test` | ✅ `out/c001-render-test.mp4`（3,501,819 字节） |
| A10 | ffprobe 1920×1080 / 30fps / 90 帧 / 3 秒 | `npm run verify:video` | ✅ 见下 |

### A10 ffprobe 结果

```
PASS  width                              1920 (want 1920)
PASS  height                             1080 (want 1080)
PASS  r_frame_rate                       30/1 (want 30)
PASS  avg_frame_rate                     30/1 (want 30)
PASS  nb_read_frames (decoded)           90 (want 90)
PASS  nb_frames (container)              90 (want 90)
PASS  stream duration                    3.000000s (want 3s)
PASS  format duration                    3.000000s (want 3s ± half frame)
PASS  codec                              h264
PASS  pix_fmt                            yuv420p
```

### A8 确定性结果（解码 RGBA 像素 SHA-256）

```
frame  0  0717ef3d7ea85a63459fdb425b0790f2f4997fa3300892f47dd82222dbea41c5  (A == B)
frame 45  9cd03bb486b33e8b164b69979f286a055fa243310c4451ad21c274d025c3b02e  (A == B)
frame 89  9844b3bb087798611355fe639b3abc17b81948ddc699654383676b35db1faffb  (A == B)
mp4 全片  eb1c056bd94ef38a…  (首渲 == 重渲)
```

上述哈希在两次独立会话（中间删除 `node_modules` 并重新安装）中完全相同。注意：仅保证同一硬件/浏览器版本下一致，见 `docs/DECISIONS.md` D-002。

### A7 环境项说明

实时 Studio 外壳会请求 `https://bugs.remotion.dev/api/4.0.525`（Remotion 已知 bug 查询）。沙箱网络阻断该域名，Chromium 记录一条资源加载失败。该请求来自 Remotion Studio 自身而非本工程代码，Studio 源码已对失败容错。验证脚本只对此单一 URL 显式输出 `ENV-ALLOWED`，其余任何错误都会判失败。只读 build 预览不发起此请求，0 错误。

## 已知问题

1. **Remotion 自带 Chrome 无法下载**：沙箱阻断 `remotion.media`，改用 `REMOTION_BROWSER_EXECUTABLE` 指向预装 Chromium 141（Remotion 4.0.525 默认使用 149）。有网环境可不设该变量。
2. **开发依赖安全公告**：`npm audit` 报 13 条，全部在开发工具链（vitest 3 / tinypool / @vitest/mocker，typescript-eslint → fast-glob → micromatch → braces）。运行时依赖 `npm audit --omit=dev` 为 0。升级到修复版 vitest 4.1.11 会触发 npm 10.9.4 arborist 崩溃（`Cannot read properties of null (reading 'edgesOut')`），因此 C001 保留 vitest 3.2.7，待后续卡片处理。
3. **跨机器像素一致性未保证**：软件 WebGL 的哈希只在同一 CPU / Chromium 版本内可比。
4. **cgroup 内存警告**：Remotion 打印"Detected differing memory amounts"，属容器 cgroup 报告值异常，不影响渲染。
