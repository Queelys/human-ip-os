# C004 RENDER REPORT — 最终成片

## 环境与版本

| 项 | 版本 |
|---|---|
| Node.js / npm | v22.22.0 / 10.9.4 |
| FFmpeg / ffprobe | 6.1.1-3ubuntu5（libx264 编码视频，原生 aac 编码音频） |
| 渲染浏览器 | Chromium Headless Shell 141.0.7390.37，SwiftShader（`swangle`，D-013） |
| Remotion | 4.0.525 |
| three / @react-three/fiber / React | 0.186.0 / 9.7.0 / 19.2.8 |
| TypeScript / Vitest / vite-node | 5.9.3 / 3.2.7 / 3.2.4 |

## 执行命令（真实运行，`scripts/acceptance-c004.sh`）

```bash
cd kunlun/mi-topology-life
REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
  npm run acceptance:c004
```

运行开始时删除 `node_modules`、`build/`、`build-debugger/`、`out/`、`renders/audio/`、`renders/masters/`，**不删除** C003 冻结成片。随后按顺序执行以下 23 步（2026-10-11 13:33:54 → 13:44:23 UTC），全部退出码为 0，最后一行 `ACCEPTANCE PASS`：

1. 记录 C003 冻结成片的 SHA-256
2. 记录版本（Node、npm、FFmpeg、Chromium）
3. `npm install`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test:log`：18 个文件，134/134 测试通过
7. `npm run build`
8. `npm run test:integration`：5/5
9. `npm run render:test`：C001 回归
10. `npm run verify:video`：C001 ffprobe 10/10
11. `npm run verify:determinism`：C001 哈希与基线逐位相同
12. `npm run verify:preview`：C001 预览
13. `npm run verify:debugger`：C002 回归 12/12
14. `npm run verify:film:video`：C003 冻结成片 ffprobe 22/22（只校验，不重渲）
15. `npm run verify:film`：C003 渲染冒烟 20/20
16. `npm run audio:master`：五条 STEM、WAV 母版、AAC、响度测量
17. `node scripts/audio-determinism.mjs`：整套音频重渲，7 个文件 SHA-256 相同
18. `npm run render:final:picture`：`MI-Final` 1080p 画面，145 s，error/WebGL 消息 0 条
19. `npm run final:mux`：流复制封装（`-c copy`，不重新编码）
20. `npm run qc:final`：44/44
21. `ffprobe` 输出存入 `evidence/c004/ffprobe-final.json`
22. 再次记录 C003 冻结成片的 SHA-256，与第 1 步相同
23. 收集证据

完整日志：`evidence/c004/acceptance-c004.log`。

## 管线

```
C002 spec ──► audio identity ─┐
C003 envelopes / Φ(t) ────────┼─► 五轨合成 → STEM → 预混 → 响度测量 → 增益/限幅 → WAV(24-bit) → AAC 256k ─┐
                              │                                                                            ├─► mux（-c copy）
C003 MiFilm（captionEnabled=false）+ C004 字幕 ──► MI-Final 渲染（H.264, CRF 18, yuv420p, 无声）────────────┘
                                                                         ↓
                                                    renders/masters/mi-final-1080p.mp4
```

## 交付物

| 文件 | 内容 | 大小 | SHA-256 |
|---|---|---|---|
| `renders/masters/mi-final-1080p.mp4` | **最终成片**：H.264 High 1920×1080 30 fps 900 帧 + AAC-LC 48 kHz 立体声 | 20.0 MB | `3eaa4963…94eb4ef` |
| `renders/audio/mi-audio-master.wav` | 完整 WAV 母版，48 kHz / 立体声 / 24-bit | 8.6 MB | `fecdfe49…01123c6` |
| `renders/audio/mi-audio-final.m4a` | 最终 AAC 音轨，256 kb/s | 0.8 MB | `05b4b769…755f5d5` |
| `renders/audio/stems/01-body.wav` … `05-finale.wav` | 五条 STEM，各 48 kHz / 立体声 / 24-bit | 各 8.6 MB | 见 `audio-report.json` |
| `renders/mi-visual-master-1080p.mp4` | C003 冻结视觉母版（**未改动**） | 19.2 MB | `62d80fb0…5599c5` |

## 媒体检测（ffprobe，最终成片）

| 流 | 参数 |
|---|---|
| 容器 | mov/mp4，时长 30.000000 s，总码率 5.34 Mb/s，faststart |
| 视频 | h264 High，1920×1080，yuv420p，r_frame_rate 30/1，avg 30/1，nb_frames 900（实际解码也是 900 帧），30.000000 s，5.11 Mb/s，start_time 0 |
| 音频 | aac LC，48000 Hz，2 声道（stereo），30.000000 s，222 kb/s（256 kb/s 目标，实际平均值），start_time 0 |

## 字幕处理（D-017）

C003 冻结母版内嵌的字幕时序与 C004.5 不同，且无法移除。为此：

- 最终画面由**同一** C003 `MiFilm` 组件关闭内嵌字幕后渲染，再叠加**一层**按 C004 时序的字幕：28.0 s 淡入，28.5 s 完全可见，29.5 s 淡出，30.0 s 结束。
- 冻结母版文件未改动。
- 帧 0–839 与冻结母版解码比较，PSNR 平均 68.4 dB、最低 50.3 dB。
- 渲染级比较：f0、f101、f300、f480、f690、f839 逐像素相同。
