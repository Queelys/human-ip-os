# MI Identity Spec V1.0

> 代码唯一来源：`src/identity/miKernel.ts` 中的 `DEFAULT_MI_SPEC`（深度冻结）。
> 校验：`src/identity/invariants.ts` 的 `validateSpec`。本文件与代码不一致时以代码为准，并视为缺陷。

## 1. 定义

**MI = (G, K, A, P, Φ, σ)**

| 符号 | 含义 | 字段 | V1.0 值 |
|---|---|---|---|
| G | 带标签的三锚点核心关系图 | `graph` | 节点 A1、A2、A3；边 E12「成形 form」、E23「传导 conduct」、E31「回归 return」（完全图 K₃） |
| K | 三叶结闭合曲线 | `knot` | 环面结 T(2,3)，R = 1.2，a = 0.6 |
| A | 三个永久身份锚点 | `anchors` | A1「骨 Structure」s = 0；A2「脉 Signal」s = 1/3；A3「息 Breath」s = 2/3 |
| P | 固定相位差脉冲协议 | `pulse` | 周期 3 s；相位偏移 [0, 1/3, 2/3]；宽度 0.25；升余弦波形 |
| Φ | 受约束的连续可逆形变族 | `deformation` | SO(3) 旋转 · 正比例缩放 s ∈ [0.25, 3] · z 轴扭转 \|k\| ≤ π/2 rad/单位 z |
| σ | 固定种子与身份版本 | `seed`, `version` | `0x4B4C4D49`（"KLMI"，与 C001 相同），`1.0.0` |

身份指纹（`identityFingerprint`，规范化 JSON 的 64 位 FNV-1a）：**`cd2e236379d37be5`**。
核心图签名（`graphSignature`）：`E12:A1->A2[成形 form]|E23:A2->A3[传导 conduct]|E31:A3->A1[回归 return]`。
两者都已在 `tests/identity.test.ts` 中锁定。任何身份字段变化都会导致测试失败。

## 2. 曲线 K

s ∈ [0, 1)，θ = 2πs：

```
K(s) = ( (R + a·cos 3θ)·cos 2θ,  (R + a·cos 3θ)·sin 2θ,  a·sin 3θ )
```

K 与 C001 测试网格 `TorusKnotGeometry(1.2, …, p=2, q=3)` 的中心线**完全一致**（`tests/trefoil.test.ts` 逐环比对，误差 < 1e-5，网格是 float32）。

## 3. 锚点 A

- 锚点身份 = 固定曲线参数 s。世界坐标始终按 **Φ(K(s))** 计算（`src/identity/anchors.ts`）。
- 不使用网格顶点索引作为身份依据。顶点索引只是一种采样方式，可以随分辨率变化；参数 s 不会变。
- 沿 K 的循环顺序固定为 A1 → A2 → A3（s 严格递增）。

## 4. 不变量

| ID | 内容 | 保证方式 |
|---|---|---|
| INV-K1 | K 为 T(2,3) 三叶结，手性固定；只施加保持定向的环境同痕 | 数学证明（MI_MATH_RULES §2–§4）+ spec 校验 p=2, q=3 + 投影交叉符号快照 |
| INV-K2 | K 闭合、正则（\|K′\| > 0）、嵌入：0 < a < R，gcd(p,q)=1 | 数学证明 §1 + 数值检查 |
| INV-A1 | 锚点由固定 s 定义，位置 = Φ(K(s)) | 代码结构 + 900 帧追踪测试 |
| INV-A2 | 锚点循环顺序 A1 → A2 → A3 | spec 校验（s 严格递增） |
| INV-G1 | G 为 {A1, A2, A3} 上带标签的完全图 | spec 校验 + 签名快照 |
| INV-P1 | 脉冲相位差固定，脉冲是 t 的纯函数 | 闭式定义 + 900 帧与性质测试 |
| INV-Φ1 | 核心形变仅为 SO(3) 旋转、正缩放、z 扭转的复合 | 类型 + 运行时拒绝其它原语 + spec 校验 |
| INV-σ1 | 所有随机由 spec 种子派生；身份指纹稳定 | 指纹快照 + 外围网络生成前后比对 |

## 5. 分层与依赖方向

```
src/identity/   身份内核：miKernel（数据）、invariants（校验）、anchors（A）
src/geometry/   纯几何：trefoil（K）、neuralGraph（外围，只读 spec）、vec3
src/motion/     deformation（Φ）、pulse（P）
src/core/       通用工具：rng、time、topology；identity.ts 是派生给 C001 的视图
src/debugger/   调试网页（表现层，只读）
src/scenes, src/compositions   Remotion 表现与镜头层（C001）
```

外围网络（`neuralGraph.ts`）通过 `variant` 可以任意变化，但只读 spec。测试已证明：生成外围网络前后，spec 序列化、指纹、图签名、K 采样完全不变。

## 6. 版本与序列化

- `serializeSpec`：键排序后的规范化 JSON，可往返。
- `parseSpec`：检查 `schema = kunlun.mi.identity`，且主版本号必须为 1；返回深度冻结对象。
- 修改任一身份字段都需要：升级 `version` → 更新本文件和 FILM_BIBLE → 更新快照 → 人工批准。
