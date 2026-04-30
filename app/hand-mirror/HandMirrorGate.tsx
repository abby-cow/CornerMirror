"use client";

import dynamic from "next/dynamic";

const HandMirrorClient = dynamic(() => import("./HandMirrorClient").then((m) => m.HandMirrorClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-white/60">加载手部镜面…</div>
  ),
});

export function HandMirrorGate() {
  return <HandMirrorClient />;
}
