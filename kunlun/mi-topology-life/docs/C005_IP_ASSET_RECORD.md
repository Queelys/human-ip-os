# C005 IP ASSET RECORD — KUNLUN-MI-FILM-001

| 字段 | 值 |
|---|---|
| 资产编号 | **KUNLUN-MI-FILM-001** |
| 作品 | 《弥：拓扑生命》 *Mi: Topological Life* |
| 系列 | 《昆仑协议》实验短片 |
| 规格 | 30 s · 900 帧 · 30 fps · 1920×1080 · 48 kHz 立体声 |
| 角色身份 | MI Identity Kernel V1.0 · 指纹 `cd2e236379d37be5` · 种子 `0x4B4C4D49` |
| 代码仓库 | `Queelys/human-ip-os`，分支 `claude/kunlun-mi-topology-life-setup-hwfq6m`，目录 `kunlun/mi-topology-life/` |
| 机器可读清单 | [`docs/archive/KUNLUN-MI-FILM-001.manifest.json`](archive/KUNLUN-MI-FILM-001.manifest.json)：每个文件的 SHA-256、字节数、来源说明和最近一次 git 提交 |
| 状态 | 技术 QC 通过；C004 人工最终验收待定；导演审片待定；**发行 BLOCKED** |

## 1. 归档分类

清单由 `node scripts/archive-manifest.mjs` 生成。文件数、体积与哈希以 JSON 为准。

| 类别 | 主要内容 | 来源 |
|---|---|---|
| 角色设定 | `FILM_BIBLE.md`、`docs/MI_IDENTITY_SPEC.md`、`src/identity/*` | C001–C002 |
| 数学规则 | `docs/MI_MATH_RULES.md`、`src/geometry/trefoil.ts`、`src/motion/deformation.ts`、`src/motion/pulse.ts` | C002 |
| 代码版本 | `package.json`、`package-lock.json`、`src/**`、`scripts/**`；清单同时记录 git HEAD 与 `src` 树哈希 | git |
| 分镜 | `SHOT_LIST.md`、`docs/C003_SHOT_LIST.md`、相机与视觉规范、C003 联系表、C005 审片关键帧 | C003 / C005 |
| 音频素材 | WAV 母版、AAC、五条 STEM | C004 程序化合成 |
| 最终视频 | `renders/masters/mi-final-1080p.mp4`（最终成片）、`renders/mi-visual-master-1080p.mp4`（C003 冻结视觉母版）、`renders/mi-preview-540p.mp4` | C003 / C004 |
| 发行物料 | — | **BLOCKED，尚未生成** |
| 授权信息 | 字体许可证、Remotion 许可证文本 | 第三方 |
| 创作与修改记录 | 各卡验收文档、`docs/DECISIONS.md`（D-001 至 D-020）、`docs/evidence/**` 原始日志 | C001–C005 |

### 核心文件校验值

| 文件 | SHA-256 |
|---|---|
| `renders/masters/mi-final-1080p.mp4` | `3eaa4963c7fc8c28b5716e71893b0b3411e3f382652a57bb663a1b41194eb4ef` |
| `renders/mi-visual-master-1080p.mp4` | `62d80fb0c63a0570085ca067f191cd7be9e1c0bbda4a96f5c3c29acee15599c5` |
| `renders/audio/mi-audio-master.wav` | `fecdfe495509edc615efe4e5112e5b75af4480a3e5a9439a9a5a6f96a01123c6` |
| `renders/audio/mi-audio-final.m4a` | `05b4b76916c90e696dcc2c81db1b5ac460b5a09206b9ac890b0e85b73755f5d5` |

## 2. 授权

| 组成 | 许可 | 用途 | 需要的动作 |
|---|---|---|---|
| 本工程代码、文档、画面与声音 | 仓库未授予开源许可，**保留所有权利**（仓库根 README「Rights」一节） | 全部 | 出品人确认权利归属主体 |
| 画面与声音内容 | 全部由本工程代码程序化生成；**没有使用外部图像、视频、音乐或音效素材** | — | 无 |
| Remotion 4.0.525（渲染框架） | Remotion License：个人、≤ 3 名员工的营利组织、非营利组织可以免费使用，包括商用；**规模更大的营利组织需要购买公司许可** | 视频渲染 | ⚠️ **发布主体需核实资格**（发布审批检查表第 5 项） |
| three.js 0.186.0、@react-three/fiber 9.7.0、React 19.2.8、@remotion/three | MIT | 3D 渲染 | 无（软件许可，不约束输出作品） |
| Noto Serif SC（字幕字形子集） | SIL Open Font License 1.1（`public/fonts/OFL.txt`） | 片尾字幕 | 嵌入成片画面，OFL 允许 |
| WenQuanYi Zen Hei（系统字体） | GPL 附字体例外 | 只用于内部联系表和审片表的标签，**不出现在成片中** | 无 |
| FFmpeg 6.1.1（含 libx264、原生 AAC 编码器） | LGPL/GPL（工具） | 编码、封装、测量 | 工具许可，不约束编码输出 |
| Chromium Headless Shell 141（SwiftShader） | BSD 等 | 离线渲染 | 无 |

## 3. 创作与修改记录

| 卡 | 日期 | 提交 | 内容 | 人工验收 |
|---|---|---|---|---|
| C001 | 2026-10-10 | `0ff5a0f`、`4ee567f` | 工程初始化与渲染链路 | ✅ 已验收（确认 (2,3) 三叶结、S01–S05 结构） |
| C002 | 2026-10-10 | `bde887f`、`4ec5e9f` | MI Identity Kernel V1.0 | ✅ 已验收（锚点标签、脉冲参数、Φ 边界；冻结身份规范） |
| C003 | 2026-10-11 | `89c6e0d`、`4cc3e10`、`4478117`、`48fab86` | 五幕视觉母版 | ✅ 已验收（ACT V 同步诠释、视觉风格；冻结视觉母版） |
| C004 | 2026-10-11 | `b28cc0c`、`7e538e7`、`8702f9d`、`2420b95` | 声音系统与最终成片 | ⏳ **人工最终验收待定** |
| C005 | 2026-10-14 | 本卡提交 | 技术 QC、审片包、归档、发行规划 | ⏳ 待定 |

关键决策见 `docs/DECISIONS.md`：

- D-013：显式启用 SwiftShader；
- D-016：ACT V「同步」不改动脉冲协议；
- D-017：最终字幕使用无字幕画面加单层字幕；
- D-020：声音与身份脉冲的频率分离。
