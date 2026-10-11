# C003 VISUAL SPEC — 灯光与视觉

代码：`src/film/visual.ts`、`src/film/starfield.ts`、`src/scenes/film/*`、`src/compositions/MiFilm.tsx`。
渲染：WebGL（`swangle`，SwiftShader），不做色调映射（`flat`），sRGB 输出。主体全部使用自发光或加色材质，不依赖场景灯光。

## 图层（由远及近）

| 层 | 实现 | 颜色 | 强度控制 |
|---|---|---|---|
| 深空背景 | 全屏四边形径向渐变着色器 | 中心 `#0c1a3a` → 边缘 `#010206` | `env.background`：0.15 → 1.0 |
| 远景星 | 2600 点，半径 45–75 | `#9fb4ff` | 不透明度 0.75 × `env.stars`，闪烁幅度 0.25 |
| 中景星 | 900 点，半径 16–32 | `#c7d6ff` | 0.55 × `env.stars`，闪烁 0.15 |
| 近景尘埃 | 120 点，半径 11–15 | `#7f9cff` | 0.22 × `env.stars`，闪烁 0.10 |
| 星系盘粒子 | C002 外围粒子 1400 点，随 Φ 变换 | `#6f86d6` | `env.discParticles`（最高 0.8） |
| 外围网络边 / 核心连线 | 线段，顶点色 × 加色混合 | `#5f7ae0` / `#3d6cff` | `env.peripheryOpacity` × 生长进度 |
| 网络节点 / 信号 | 点精灵，加色 | `#a9c1ff` / `#c8fbff` | 节点可见度 / 信号包络 |
| 核心图弦 G | 线段 | `#e8f4ff` | `env.chords`（最高 0.68） |
| 主结 K（冷青色曲线） | 管道，核心半径 0.035 | `#9ff4ff` | 0.55 + 0.6 × `env.coreGlow` |
| 主结辉光 | 两层加色外壳，半径 0.085 / 0.17 | `#2f8dff` / `#1c4dff` | 0.22 / 0.07 × `env.coreGlow` |
| 生长端亮点 | 精灵 | `#d8fbff` | 仅在弧生长时出现 |
| 锚点 | 实心球 + 光晕精灵 + ACT IV 轨迹 | A1 `#ffd38a`，A2 `#8affd0`，A3 `#ff9ad8` | 见下式 |
| 字幕 | HTML 文字，内嵌字体 | `#e6eeff`，柔和蓝色字影 | `env.caption` |

## 锚点亮度

```
brightness = visibility × (0.55 + 0.9 · pulseGain · P_i(t) + 0.6 · resonance(t) · (0.75 + 0.25·cos(2πt/T)))
```

- `P_i(t)`：C002 脉冲协议原值（`pulseIntensity`），未经修改。
- `pulseGain`、`resonance`：表现层包络。共振项对三个锚点使用**同一相位**，实现 ACT V 的"同步"。

## 闪烁与随机性

- 所有随机量（星的位置、大小、相位、频率；信号相位；外围网络）都通过 `createRng(spec.seed, label)` 由固定种子派生。
- 星的闪烁是有界的闭式函数：`亮度 ∈ [base·(1 − amp), base]`，频率 0.08–0.43 Hz，在着色器里由 `uTime = frame / fps` 计算。
- **没有无控制的随机闪烁**：画面亮度的所有变化都来自确定性包络或 P 协议。

## 字幕

- 字体：Noto Serif SC Medium 子集（仅包含字幕用到的 14 个字形），文件 `public/fonts/NotoSerifSC-Medium-caption.ttf`（5.5 KB），许可证 SIL OFL 1.1（`public/fonts/OFL.txt`）。
- 通过 `FontFace` 加载，并用 `delayRender` 等待加载完成。字体加载失败，或 `document.fonts.check` 未通过时，调用 `cancelRender` 使渲染失败，**绝不回退到系统字体**。
- 版式：字号 54 px，字间距 0.12 em，水平居中，文字块底边距画面底部 150 px。
- 标题安全区为 90 %：x ∈ [96, 1824]，y ∈ [54, 1026]。像素级验证见 `C003_ACCEPTANCE.md`。

## 几何安全

核心管道半径 0.035。900 帧中最小链间距为 0.622，管道半径远小于 0.3 × 0.622 = 0.187，满足 C002 MI_MATH_RULES §9 的约束。
两层辉光外壳是加色半透明光晕，不是实体表面，所以不参与这一判据。
