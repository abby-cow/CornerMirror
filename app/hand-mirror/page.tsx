import type { Metadata } from "next";
import { HandMirrorGate } from "./HandMirrorGate";

export const metadata: Metadata = {
  title: "手部镜面 · MediaPipe",
  description: "摄像头手部关键点与食指驱动的局部镜面畸变",
};

export default function HandMirrorPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900">
      <HandMirrorGate />
    </main>
  );
}
