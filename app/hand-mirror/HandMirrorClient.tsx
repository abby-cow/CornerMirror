"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HAND_SKELETON } from "./hand-connections";
import { PressMirrorRenderer } from "./press-canvas-renderer";

type NormalizedLm = { x: number; y: number; z: number };
type HandLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks: NormalizedLm[][] };
  close: () => void;
};

const MP_VERSION = "0.10.35";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

const INDEX_TIP = 8;
const SMOOTH_RATE_XY = 14;
const SMOOTH_RATE_DEPTH = 16;
const CONTACT_STABLE_FRAMES = 2;

function smoothToward(current: number, target: number, ratePerSec: number, dt: number): number {
  const a = 1 - Math.exp(-ratePerSec * dt);
  return current + (target - current) * a;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function HandMirrorClient() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PressMirrorRenderer | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);

  const smoothUx = useRef(0.5);
  const smoothUy = useRef(0.5);
  const smoothDepth = useRef(0);
  const smoothRadius = useRef(0.1);
  const smoothStrength = useRef(0);
  const zNearRef = useRef(-0.2);
  const zFarRef = useRef(0.05);
  const contactStableRef = useRef(0);
  const pressAmountRef = useRef(0);
  const pressVelocityRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const resizeAll = useCallback(() => {
    const wrap = wrapRef.current;
    const glC = glCanvasRef.current;
    const ov = overlayRef.current;
    const r = rendererRef.current;
    if (!wrap || !glC || !ov || !r) return;
    const { width, height } = wrap.getBoundingClientRect();
    r.resize(width, height);
    ov.width = glC.width;
    ov.height = glC.height;
    ov.style.width = `${width}px`;
    ov.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const glCanvas = glCanvasRef.current;
    if (!video || !glCanvas) return;

    let stream: MediaStream | null = null;
    let renderer: PressMirrorRenderer;

    try {
      renderer = new PressMirrorRenderer(glCanvas);
    } catch {
      queueMicrotask(() => setError("当前环境不支持 WebGL2。"));
      return;
    }
    rendererRef.current = renderer;
    renderer.setSource(video);
    renderer.start();

    const setup = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        resizeAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "无法打开摄像头。");
        return;
      }

      try {
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE, false);
        const opts = {
          baseOptions: {
            modelAssetPath: HAND_MODEL,
            delegate: "GPU" as const,
          },
          runningMode: "VIDEO" as const,
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        };
        let handLandmarker = await HandLandmarker.createFromOptions(fileset, opts).catch(() => null);
        if (!handLandmarker) {
          handLandmarker = await HandLandmarker.createFromOptions(fileset, {
            ...opts,
            baseOptions: { ...opts.baseOptions, delegate: "CPU" },
          });
        }
        if (cancelled) {
          handLandmarker.close();
          return;
        }
        landmarkerRef.current = handLandmarker;
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "MediaPipe 手部模型加载失败。");
      }
    };

    void setup();

    const ro = new ResizeObserver(() => resizeAll());
    const el = wrapRef.current;
    if (el) ro.observe(el);
    window.addEventListener("resize", resizeAll);
    const t = requestAnimationFrame(() => resizeAll());

    return () => {
      cancelled = true;
      cancelAnimationFrame(t);
      ro.disconnect();
      window.removeEventListener("resize", resizeAll);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      stream?.getTracks().forEach((s) => s.stop());
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [resizeAll]);

  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const handLm = landmarkerRef.current;
    if (!video || !overlay || !handLm) return;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    let lastTs = performance.now();
    let frame = 0;

    const drawLoop = (ts: number) => {
      frame = requestAnimationFrame(drawLoop);
      const dt = Math.min(0.08, (ts - lastTs) / 1000);
      lastTs = ts;

      const w = overlay.width;
      const h = overlay.height;
      const renderer = rendererRef.current;
      if (!renderer || w < 2 || h < 2) return;

      const result = handLm.detectForVideo(video, ts);
      const lmList = result.landmarks;
      const hasHand = lmList.length > 0 && lmList[0].length > INDEX_TIP;
      const connections = HAND_SKELETON;

      let targetUx = smoothUx.current;
      let targetUy = smoothUy.current;
      let targetDepth = 0;
      let tipInsideMirror = false;

      if (hasHand) {
        const tip = lmList[0][INDEX_TIP]!;
        targetUx = tip.x;
        targetUy = tip.y;
        zNearRef.current = Math.min(zNearRef.current, tip.z);
        zFarRef.current = Math.max(zFarRef.current, tip.z);
        const zSpan = Math.max(0.03, zFarRef.current - zNearRef.current);
        targetDepth = clamp01((zFarRef.current - tip.z) / zSpan);
        const hud = hudRef.current;
        if (hud) {
          hud.textContent = `x: ${tip.x.toFixed(4)} · y: ${tip.y.toFixed(4)} · z: ${tip.z.toFixed(4)} · depth: ${targetDepth.toFixed(3)} · press: ${pressAmountRef.current.toFixed(3)}`;
        }
        const aspectNorm = w / Math.max(1, h);
        const px = (tip.x * 2 - 1) * aspectNorm;
        const py = tip.y * 2 - 1;
        tipInsideMirror = px * px + py * py <= 1;
      } else {
        const hud = hudRef.current;
        if (hud) hud.textContent = "未检测到手部";
      }

      smoothUx.current = smoothToward(smoothUx.current, targetUx, SMOOTH_RATE_XY, dt);
      smoothUy.current = smoothToward(smoothUy.current, targetUy, SMOOTH_RATE_XY, dt);
      smoothDepth.current = smoothToward(smoothDepth.current, hasHand ? targetDepth : 0, SMOOTH_RATE_DEPTH, dt);

      if (hasHand && tipInsideMirror) {
        contactStableRef.current += 1;
      } else {
        contactStableRef.current = 0;
      }
      const hasContact = contactStableRef.current >= CONTACT_STABLE_FRAMES;

      // Spring-like press response for physical push/release.
      const targetPress = hasContact ? smoothDepth.current : 0;
      const stiffness = 92;
      const damping = 18;
      const acc = (targetPress - pressAmountRef.current) * stiffness - pressVelocityRef.current * damping;
      pressVelocityRef.current += acc * dt;
      pressAmountRef.current = clamp01(pressAmountRef.current + pressVelocityRef.current * dt);

      const minDim = Math.min(w, h);
      const baseRuv = 48 / minDim;
      const maxRuv = 0.62;
      const targetRadius = baseRuv + pressAmountRef.current * (maxRuv - baseRuv);
      const targetStrength = hasContact ? 0.2 + pressAmountRef.current * 1.3 : 0;

      smoothRadius.current = smoothToward(smoothRadius.current, targetRadius, SMOOTH_RATE_DEPTH, dt);
      smoothStrength.current = smoothToward(smoothStrength.current, targetStrength, SMOOTH_RATE_DEPTH, dt);

      renderer.pressU = smoothUx.current;
      renderer.pressV = smoothUy.current;
      renderer.pressRadius = smoothRadius.current;
      renderer.pressStrength = smoothStrength.current;
      renderer.contact = hasContact ? 1 : 0;

      ctx.clearRect(0, 0, w, h);
      if (hasHand && lmList[0]) {
        const lm = lmList[0];
        ctx.strokeStyle = "rgba(34, 211, 238, 0.75)";
        ctx.lineWidth = 2;
        for (const c of connections) {
          const a = lm[c.start];
          const b = lm[c.end];
          if (!a || !b) continue;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
        for (let i = 0; i < lm.length; i++) {
          if (i === INDEX_TIP) continue;
          const p = lm[i]!;
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        const tip = lm[INDEX_TIP]!;
        const ringPx = smoothRadius.current * Math.min(w, h);
        ctx.strokeStyle = hasContact ? "rgba(251, 191, 36, 0.95)" : "rgba(148, 163, 184, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tip.x * w, tip.y * h, Math.max(12, ringPx), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(tip.x * w, tip.y * h, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    frame = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 text-white">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">手部按压镜面（MediaPipe）</h1>
        <p className="text-sm text-white/65">
          先做全局凸面鱼眼，再在食指接触点叠加局部凹陷；z 越小表示越靠近相机，凹陷半径与强度随之增大，并做指数平滑。
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div
        ref={wrapRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10"
      >
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
        <canvas ref={glCanvasRef} className="absolute inset-0 h-full w-full object-cover" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      </div>

      <div className="grid gap-2 text-sm text-white/70 md:grid-cols-2">
        <div className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-wide text-white/45">食指指尖（归一化）</div>
          <div ref={hudRef} className="mt-1 font-mono tabular-nums text-white/90">
            —
          </div>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-wide text-white/45">状态</div>
          <div className="mt-1 text-white/90">{ready ? "模型已就绪" : "正在加载模型…"}</div>
        </div>
      </div>
    </div>
  );
}
