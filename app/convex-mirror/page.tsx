import type { Metadata } from "next";
import { ConvexMirrorClient } from "./ConvexMirrorClient";

export const metadata: Metadata = {
  title: "凸面镜 · 鱼眼与涂鸦",
  description:
    "全屏街景背景下的道路凸面镜：摄像头或图片鱼眼映射、镜面涂鸦与边缘贴纸。",
};

export default function ConvexMirrorPage() {
  return <ConvexMirrorClient />;
}
