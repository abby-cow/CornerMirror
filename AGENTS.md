<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:interaction-animation-rules -->
## Cursor 专用：丝滑交互动画规范（全局）

### Core Philosophy
- Fluid & interruption-ready：所有动画可中断，支持手势跟手。
- Contextual continuity：避免硬切换，优先共享元素过渡（shared elements）。
- 禁止使用 `linear` 缓动曲线。

### Spring Physics Config
- Standard（标准过渡）：`stiffness: 170, damping: 26, mass: 1`
- Prominent（强调交互）：`stiffness: 120, damping: 14, mass: 1`
- Responsive（快速反馈）：`stiffness: 300, damping: 30, mass: 1`

### 核心交互实现约定
- 卡片展开（CapWords Expand）：
  - 使用共享元素（`layoutId` / `matchedGeometryEffect` / Reanimated 对应能力）。
  - 主图尺寸与圆角连续过渡（卡片态 -> 全屏态）。
  - 文字使用淡入 + Y 轴微位移，不做硬切。
- 列表滚动与视差：
  - 列表项靠近屏幕边缘时做轻微缩放（Apple Store 风格）。
  - 背景与前景位移比约 `1 : 1.2` 制造景深。
- 按钮微交互：
  - 图标点击执行 `scale: 0.9 -> 1.1 -> 1.0` 的弹簧动画。
  - 可配合背景模糊扩散（blur spread）营造律动。

### Framer Motion 参考
```tsx
const springConfig = { type: "spring", stiffness: 170, damping: 26, mass: 1 };

<motion.div
  layoutId={id}
  transition={springConfig}
  style={{ borderRadius: isExpanded ? "0px" : "20px" }}
>
  <motion.h2 layout="position">舞曲标题</motion.h2>
</motion.div>
```
<!-- END:interaction-animation-rules -->
