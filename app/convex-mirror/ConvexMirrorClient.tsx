"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { FishEyeRenderer } from "./fish-eye-renderer";

const springTap = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };
const springProminent = { type: "spring" as const, stiffness: 120, damping: 14, mass: 1 };

/** 未配置动图时的静态街景底图 */
const STREET_FALLBACK_SRC =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1920&q=80";

/**
 * 本地背景：把 GIF/图片放到 `public/` 下，默认使用 `public/bg4.gif`。
 * 页面引用为根路径 `/bg4.gif`（不是磁盘绝对路径）。
 *
 * 环境变量可覆盖（远程或本地路径均可）：
 *   NEXT_PUBLIC_CONVEX_MIRROR_BG="/other.gif"
 */
const LOCAL_BG_POOL = ["/bg1.gif", "/bg2.gif", "/bg3.gif", "/bg4.gif", "/bg5.gif", "/bg6.gif"] as const;
const LOCAL_MIRROR_BG = "/bg4.gif";

/** 凸面镜外圈描边主色 */
const LENS_RIM = "#570000";

function initialMirrorBgSrc(): string {
  const e = process.env.NEXT_PUBLIC_CONVEX_MIRROR_BG?.trim();
  if (e) return e;
  return LOCAL_MIRROR_BG;
}

type Tool = "none" | "draw" | "sticker";

type StickerItem = {
  id: string;
  /** 0..1 相对镜面容器左上 */
  nx: number;
  ny: number;
  glyph: string;
  scale: number;
};

const STICKER_OPTIONS = ["⚠️", "🚧", "🚶", "🌳", "☀️", "📍", "⭐", "🎯"];
const MP_VERSION = "0.10.35";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const INDEX_TIP = 8;

type NormalizedLm = { x: number; y: number; z: number };
type HandLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks: NormalizedLm[][] };
  close: () => void;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 擦除遮罩后露出摄像头的面积占比超过该值则视为完全开启 */
const SCRATCH_REVEAL_THRESHOLD = 0.5;
/** 采样网格边长，越大越准、略耗性能 */
const SCRATCH_SAMPLE_GRID = 44;
/** 采样时 alpha 低于此视为已擦除 */
const SCRATCH_ALPHA_CUT = 40;

type ScratchPhase = "off" | "loading" | "erasing";

function fillScratchMaskOpaque(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const g = ctx.createRadialGradient(cx * 0.84, cy * 0.68, r * 0.08, cx, cy, r * 1.02);
  g.addColorStop(0, "rgb(245,245,246)");
  g.addColorStop(0.28, "rgb(223,223,225)");
  g.addColorStop(0.68, "rgb(176,177,181)");
  g.addColorStop(1, "rgb(136,137,142)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function estimateScratchRevealFraction(maskCanvas: HTMLCanvasElement): number {
  const gw = SCRATCH_SAMPLE_GRID;
  const gh = SCRATCH_SAMPLE_GRID;
  const sm = document.createElement("canvas");
  sm.width = gw;
  sm.height = gh;
  const sctx = sm.getContext("2d");
  if (!sctx) return 0;
  sctx.drawImage(maskCanvas, 0, 0, gw, gh);
  let data: ImageData;
  try {
    data = sctx.getImageData(0, 0, gw, gh);
  } catch {
    return 0;
  }
  const r = Math.min(gw, gh) / 2;
  const cx = gw / 2;
  const cy = gh / 2;
  let inCircle = 0;
  let revealed = 0;
  const px = data.data;
  for (let iy = 0; iy < gh; iy++) {
    for (let ix = 0; ix < gw; ix++) {
      const dx = ix + 0.5 - cx;
      const dy = iy + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      inCircle++;
      const a = px[(iy * gw + ix) * 4 + 3]!;
      if (a < SCRATCH_ALPHA_CUT) revealed++;
    }
  }
  return inCircle > 0 ? revealed / inCircle : 0;
}

/** 点击位置映射到圆内（单位圆），返回镜面容器内 0..1 坐标 */
function clientToCircleNorm(rect: DOMRect, clientX: number, clientY: number) {
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  let px = nx * 2 - 1;
  let py = ny * 2 - 1;
  const d = Math.hypot(px, py);
  if (d > 1 && d > 1e-6) {
    px /= d;
    py /= d;
  }
  return { nx: (px + 1) * 0.5, ny: (py + 1) * 0.5 };
}

function clampNormToCircle(nx: number, ny: number) {
  let px = nx * 2 - 1;
  let py = ny * 2 - 1;
  const d = Math.hypot(px, py);
  if (d > 1 && d > 1e-6) {
    px /= d;
    py /= d;
  }
  return { nx: (px + 1) * 0.5, ny: (py + 1) * 0.5 };
}

/** 指尖按压（与 shader 同空间），用于贴纸微形变；与鱼眼强度/焦距滑杆无关 */
type PressSnap = { u: number; v: number; s: number; c: number };
const PRESS_IDLE: PressSnap = { u: 0.5, v: 0.5, s: 0, c: 0 };

/** 固定球面基底（不读 distortion/zoom）+ 按压带来的微小附加形变 */
function stickerMirrorTransform(nx: number, ny: number, userScale: number, press: PressSnap) {
  const px = nx * 2 - 1;
  const py = ny * 2 - 1;
  const rd = Math.min(1, Math.hypot(px, py));
  const inv = rd > 1e-6 ? 1 / rd : 0;
  const kDome = 15;
  const rotY = kDome * rd * px * inv;
  const rotX = -kDome * rd * py * inv;

  const du = nx - press.u;
  const dv = ny - press.v;
  const dist2 = du * du + dv * dv;
  const sigma = 0.052 + press.s * 0.065;
  const w = press.c * press.s * Math.exp(-dist2 / (sigma * sigma));
  const microScale = 1 + w * 0.072;
  const nlen = Math.hypot(du, dv) + 1e-5;
  const tx = (du / nlen) * w * 6.5;
  const ty = (dv / nlen) * w * 6.5;
  const rotX2 = rotX - w * 7.5;
  const rotY2 = rotY + (du / nlen) * w * 5.5;

  return `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotateX(${rotX2}deg) rotateY(${rotY2}deg) scale(${userScale * microScale})`;
}

export function ConvexMirrorClient() {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FishEyeRenderer | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const trackingRafRef = useRef(0);
  const bgShuffleDeckRef = useRef<string[]>([]);
  const bgShuffleIndexRef = useRef(0);
  const zNearRef = useRef(-0.2);
  const zFarRef = useRef(0.05);
  const smoothURef = useRef(0.5);
  const smoothVRef = useRef(0.5);
  const smoothPressRef = useRef(0);
  const smoothVelRef = useRef(0);
  const stableRef = useRef(0);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const scratchDragRef = useRef(false);
  const lastScratchPtRef = useRef<{ x: number; y: number } | null>(null);
  const scratchAreaPendingRef = useRef(false);
  const scratchPhaseRef = useRef<ScratchPhase>("off");
  const dragStickerRef = useRef<{ id: string; startClientX: number; startClientY: number; nx0: number; ny0: number } | null>(
    null,
  );
  /** 仅按下指针时显示描边，松手即消 */
  const [grippedStickerId, setGrippedStickerId] = useState<string | null>(null);
  const [pressSnap, setPressSnap] = useState<PressSnap>(PRESS_IDLE);
  const [mirrorBgSrc, setMirrorBgSrc] = useState(initialMirrorBgSrc);

  const [tool, setTool] = useState<Tool>("none");
  const [cameraOn, setCameraOn] = useState(false);
  const [scratchPhase, setScratchPhase] = useState<ScratchPhase>("off");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [stickerPick, setStickerPick] = useState(STICKER_OPTIONS[0]);
  const [brushHue, setBrushHue] = useState(48);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  const [distortion, setDistortion] = useState(0.68);
  /** Smaller = wider view (full body); larger = tighter crop (close-up). */
  const [fieldZoom, setFieldZoom] = useState(0.46);
  const isLiveLens = cameraOn || hasUploadedImage;
  const showDefaultLens = !isLiveLens;

  useEffect(() => {
    scratchPhaseRef.current = scratchPhase;
  }, [scratchPhase]);

  const buildBgShuffleDeck = useCallback((current: string) => {
    const deck = [...LOCAL_BG_POOL];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    // 避免点击后“看起来没变化”（第一张与当前相同）
    if (deck.length > 1 && deck[0] === current) {
      [deck[0], deck[1]] = [deck[1]!, deck[0]!];
    }
    return deck;
  }, []);

  const rotateBackground = useCallback(() => {
    if (
      bgShuffleDeckRef.current.length !== LOCAL_BG_POOL.length ||
      bgShuffleIndexRef.current >= bgShuffleDeckRef.current.length
    ) {
      bgShuffleDeckRef.current = buildBgShuffleDeck(mirrorBgSrc);
      bgShuffleIndexRef.current = 0;
    }
    let next = bgShuffleDeckRef.current[bgShuffleIndexRef.current++] ?? LOCAL_MIRROR_BG;
    if (next === mirrorBgSrc) {
      if (bgShuffleIndexRef.current >= bgShuffleDeckRef.current.length) {
        bgShuffleDeckRef.current = buildBgShuffleDeck(mirrorBgSrc);
        bgShuffleIndexRef.current = 0;
      }
      next = bgShuffleDeckRef.current[bgShuffleIndexRef.current++] ?? LOCAL_MIRROR_BG;
    }
    setMirrorBgSrc(next);
  }, [buildBgShuffleDeck, mirrorBgSrc]);

  const resizeGl = useCallback(() => {
    const wrap = wrapRef.current;
    const c = glCanvasRef.current;
    const renderer = rendererRef.current;
    if (!wrap || !c || !renderer) return;
    const { width, height } = wrap.getBoundingClientRect();
    renderer.resize(width, height);
  }, []);

  const resizeDraw = useCallback(() => {
    const wrap = wrapRef.current;
    const c = drawCanvasRef.current;
    if (!wrap || !c) return;
    const { width, height } = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    c.width = Math.max(2, Math.floor(width * dpr));
    c.height = Math.max(2, Math.floor(height * dpr));
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
  }, []);

  const resizeScratchMask = useCallback(() => {
    const wrap = wrapRef.current;
    const c = scratchMaskCanvasRef.current;
    if (!wrap || !c) return;
    const { width, height } = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    c.width = Math.max(2, Math.floor(width * dpr));
    c.height = Math.max(2, Math.floor(height * dpr));
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    const c = glCanvasRef.current;
    if (!c) return;
    let renderer: FishEyeRenderer;
    try {
      renderer = new FishEyeRenderer(c);
    } catch {
      queueMicrotask(() =>
        setUploadError("当前环境不支持 WebGL2，无法渲染鱼眼镜面。"),
      );
      return;
    }
    rendererRef.current = renderer;
    renderer.start();
    resizeGl();
    const ro = new ResizeObserver(() => {
      resizeGl();
      resizeDraw();
      resizeScratchMask();
      if (scratchPhaseRef.current === "erasing") {
        const c = scratchMaskCanvasRef.current;
        const ctx = c?.getContext("2d");
        if (c && ctx) fillScratchMaskOpaque(ctx, c.width, c.height);
      }
    });
    const el = wrapRef.current;
    if (el) ro.observe(el);
    window.addEventListener("resize", resizeGl);
    window.addEventListener("resize", resizeDraw);
    window.addEventListener("resize", resizeScratchMask);
    return () => {
      window.removeEventListener("resize", resizeGl);
      window.removeEventListener("resize", resizeDraw);
      window.removeEventListener("resize", resizeScratchMask);
      ro.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [resizeDraw, resizeGl, resizeScratchMask]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.strength = distortion;
    r.vignette = 0.28;
    r.zoom = fieldZoom;
  }, [distortion, fieldZoom]);

  useEffect(() => {
    if (cameraOn) return;
    const r = rendererRef.current;
    if (!r) return;
    r.contact = 0;
    r.pressStrength = 0;
    smoothPressRef.current = 0;
    smoothVelRef.current = 0;
  }, [cameraOn]);

  const setActiveSource = useCallback((src: TexImageSource | null) => {
    rendererRef.current?.setSource(src);
  }, []);

  const clearScratchMaskCanvas = useCallback(() => {
    const c = scratchMaskCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }, []);

  const stopCamera = useCallback(() => {
    if (trackingRafRef.current) {
      cancelAnimationFrame(trackingRafRef.current);
      trackingRafRef.current = 0;
    }
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
    setCameraOn(false);
    setScratchPhase("off");
    queueMicrotask(() => clearScratchMaskCanvas());
    stableRef.current = 0;
    if (imageRef.current) {
      setActiveSource(imageRef.current);
    } else {
      setActiveSource(null);
    }
  }, [clearScratchMaskCanvas, setActiveSource]);

  const resetLens = useCallback(() => {
    stopCamera();
    imageRef.current = null;
    setHasUploadedImage(false);
    setActiveSource(null);
  }, [setActiveSource, stopCamera]);

  const startCamera = useCallback(async (via: "button" | "scratch" = "button") => {
    setUploadError(null);
    if (via === "button") {
      setScratchPhase("off");
    } else {
      setScratchPhase("loading");
    }
    setHasUploadedImage(false);
    imageRef.current = null;
    zNearRef.current = -0.2;
    zFarRef.current = 0.05;
    smoothURef.current = 0.5;
    smoothVRef.current = 0.5;
    smoothPressRef.current = 0;
    smoothVelRef.current = 0;
    stableRef.current = 0;
    const r0 = rendererRef.current;
    if (r0) {
      r0.contact = 0;
      r0.pressStrength = 0;
      r0.pressRadius = 0.14;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setCameraOn(true);
      setActiveSource(v);
      if (via === "scratch") {
        setScratchPhase("erasing");
      }
    } catch (e) {
      setScratchPhase("off");
      setUploadError(
        e instanceof Error ? e.message : "无法访问摄像头，请检查权限或改用上传图片。",
      );
    }
  }, [setActiveSource]);

  const onUpload = useCallback(
    (file: File | null) => {
      setUploadError(null);
      if (!file || !file.type.startsWith("image/")) return;
      stopCamera();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setHasUploadedImage(true);
        setActiveSource(img);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setUploadError("图片加载失败。");
      };
      img.src = url;
    },
    [setActiveSource, stopCamera],
  );

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const run = async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE, false);
        const opts = {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" as const },
          runningMode: "VIDEO" as const,
          numHands: 1,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        };
        let hand = await HandLandmarker.createFromOptions(fileset, opts).catch(() => null);
        if (!hand) {
          hand = await HandLandmarker.createFromOptions(fileset, {
            ...opts,
            baseOptions: { ...opts.baseOptions, delegate: "CPU" as const },
          });
        }
        if (cancelled) {
          hand.close();
          return;
        }
        landmarkerRef.current = hand;
      } catch {
        return;
      }

      let lastTs = performance.now();
      const tick = (ts: number) => {
        trackingRafRef.current = requestAnimationFrame(tick);
        const hand = landmarkerRef.current;
        const r = rendererRef.current;
        if (!hand || !r || !video) return;
        const dt = Math.min(0.08, (ts - lastTs) / 1000);
        lastTs = ts;
        const result = hand.detectForVideo(video, ts);
        const lm = result.landmarks?.[0];
        let contact = false;
        let targetPress = 0;

        if (lm && lm.length > INDEX_TIP) {
          const tip = lm[INDEX_TIP]!;
          smoothURef.current += (tip.x - smoothURef.current) * 0.22;
          smoothVRef.current += (tip.y - smoothVRef.current) * 0.22;
          r.pressU = smoothURef.current;
          r.pressV = smoothVRef.current;

          zNearRef.current = Math.min(zNearRef.current, tip.z);
          zFarRef.current = Math.max(zFarRef.current, tip.z);
          const span = Math.max(0.03, zFarRef.current - zNearRef.current);
          const depth01 = clamp01((zFarRef.current - tip.z) / span);

          const px = tip.x * 2 - 1;
          const py = tip.y * 2 - 1;
          const inside = px * px + py * py <= 0.98;
          stableRef.current = inside ? stableRef.current + 1 : 0;
          contact = stableRef.current >= 2;
          if (contact) {
            targetPress = depth01;
            // Non-linear growth: area expands more obviously as finger moves forward.
            const pressCurve = Math.pow(depth01, 0.72);
            r.pressRadius = 0.11 + pressCurve * 0.62;
            r.pressStrength = 0.2 + pressCurve * 1.45;
          }
        } else {
          stableRef.current = 0;
        }

        const k = 96;
        const c = 18;
        const acc = (targetPress - smoothPressRef.current) * k - smoothVelRef.current * c;
        smoothVelRef.current += acc * dt;
        smoothPressRef.current = clamp01(smoothPressRef.current + smoothVelRef.current * dt);
        r.contact = contact ? 1 : 0;
        if (!contact) {
          r.pressStrength *= 0.86;
        }

        setPressSnap((prev) => {
          const n = { u: r.pressU, v: r.pressV, s: r.pressStrength, c: r.contact };
          if (
            Math.abs(n.u - prev.u) < 0.003 &&
            Math.abs(n.v - prev.v) < 0.003 &&
            Math.abs(n.s - prev.s) < 0.012 &&
            Math.abs(n.c - prev.c) < 0.015
          ) {
            return prev;
          }
          return n;
        });
      };

      trackingRafRef.current = requestAnimationFrame(tick);
    };

    void run();
    return () => {
      cancelled = true;
      if (trackingRafRef.current) {
        cancelAnimationFrame(trackingRafRef.current);
        trackingRafRef.current = 0;
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      queueMicrotask(() => setPressSnap(PRESS_IDLE));
    };
  }, [cameraOn]);

  useEffect(() => {
    if (!cameraOn) {
      queueMicrotask(() => setPressSnap(PRESS_IDLE));
    }
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (tool !== "sticker") {
      dragStickerRef.current = null;
      queueMicrotask(() => setGrippedStickerId(null));
    }
  }, [tool]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragStickerRef.current;
      const wrap = wrapRef.current;
      if (!d || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const nx = d.nx0 + (e.clientX - d.startClientX) / rect.width;
      const ny = d.ny0 + (e.clientY - d.startClientY) / rect.height;
      const c = clampNormToCircle(nx, ny);
      setStickers((prev) => prev.map((s) => (s.id === d.id ? { ...s, nx: c.nx, ny: c.ny } : s)));
    };
    const onUp = () => {
      dragStickerRef.current = null;
      setGrippedStickerId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const getLocalPoint = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const x = (clientX - r.left) * dpr;
    const y = (clientY - r.top) * dpr;
    const cx = (r.width / 2) * dpr;
    const cy = (r.height / 2) * dpr;
    const radius = (Math.min(r.width, r.height) / 2) * dpr;
    return { x, y, cx, cy, radius };
  };

  const getCircleDevice = () => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const cx = (r.width / 2) * dpr;
    const cy = (r.height / 2) * dpr;
    const radius = (Math.min(r.width, r.height) / 2) * dpr;
    return { cx, cy, radius };
  };

  const inCircle = (
    lx: number,
    ly: number,
    info: NonNullable<ReturnType<typeof getLocalPoint>>,
  ) => {
    const dx = lx - info.cx;
    const dy = ly - info.cy;
    return dx * dx + dy * dy <= info.radius * info.radius;
  };

  const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const info = getCircleDevice();
    if (!info) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.radius - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = `hsla(${brushHue}, 95%, 58%, 0.92)`;
    ctx.lineWidth = Math.max(3, info.radius * 0.018);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  };

  const onPointerDownDraw = (e: React.PointerEvent) => {
    if (tool !== "draw") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = getLocalPoint(e.clientX, e.clientY);
    if (!pt || !inCircle(pt.x, pt.y, pt)) return;
    drawingRef.current = true;
    lastPtRef.current = { x: pt.x, y: pt.y };
  };

  const onPointerMoveDraw = (e: React.PointerEvent) => {
    if (tool !== "draw" || !drawingRef.current) return;
    const pt = getLocalPoint(e.clientX, e.clientY);
    if (!pt) return;
    const last = lastPtRef.current;
    if (last && inCircle(pt.x, pt.y, pt)) {
      drawLine(last.x, last.y, pt.x, pt.y);
    }
    if (inCircle(pt.x, pt.y, pt)) {
      lastPtRef.current = { x: pt.x, y: pt.y };
    }
  };

  const onPointerUpDraw = (e: React.PointerEvent) => {
    drawingRef.current = false;
    lastPtRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const clearMirrorDecor = useCallback(() => {
    const c = drawCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    setStickers([]);
    setGrippedStickerId(null);
    dragStickerRef.current = null;
  }, []);

  const placeStickerAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = wrapRef.current;
      if (!wrap || tool !== "sticker") return;
      const rect = wrap.getBoundingClientRect();
      const { nx, ny } = clientToCircleNorm(rect, clientX, clientY);
      const id = `${uid}-${Date.now()}`;
      setStickers((s) => [...s, { id, nx, ny, glyph: stickerPick, scale: 1 }]);
    },
    [stickerPick, tool, uid],
  );

  const removeSticker = useCallback((id: string) => {
    setStickers((p) => p.filter((x) => x.id !== id));
    setGrippedStickerId((cur) => (cur === id ? null : cur));
  }, []);

  const eraseScratchSegment = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const c = scratchMaskCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const info = getCircleDevice();
    if (!info) return;
    const brush = Math.max(26, info.radius * 0.112);
    ctx.save();
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = brush * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }, []);

  const scheduleScratchAreaCheck = useCallback(() => {
    if (scratchAreaPendingRef.current) return;
    scratchAreaPendingRef.current = true;
    requestAnimationFrame(() => {
      scratchAreaPendingRef.current = false;
      const mc = scratchMaskCanvasRef.current;
      if (!mc || scratchPhaseRef.current !== "erasing") return;
      const frac = estimateScratchRevealFraction(mc);
      if (frac >= SCRATCH_REVEAL_THRESHOLD) {
        const ctx = mc.getContext("2d");
        ctx?.clearRect(0, 0, mc.width, mc.height);
        setScratchPhase("off");
      }
    });
  }, []);

  useLayoutEffect(() => {
    if (scratchPhase !== "erasing") return;
    const c = scratchMaskCanvasRef.current;
    if (!c) return;
    resizeScratchMask();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    fillScratchMaskOpaque(ctx, c.width, c.height);
  }, [scratchPhase, resizeScratchMask]);

  const onScratchEntryPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (tool !== "none" || isLiveLens || scratchPhase !== "off") return;
      void startCamera("scratch");
    },
    [isLiveLens, scratchPhase, startCamera, tool],
  );

  const onPointerDownScratchMask = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      scratchDragRef.current = true;
      const pt = getLocalPoint(e.clientX, e.clientY);
      if (!pt || !inCircle(pt.x, pt.y, pt)) {
        lastScratchPtRef.current = null;
        return;
      }
      lastScratchPtRef.current = { x: pt.x, y: pt.y };
      eraseScratchSegment(pt.x, pt.y, pt.x, pt.y);
      scheduleScratchAreaCheck();
    },
    [eraseScratchSegment, scheduleScratchAreaCheck],
  );

  const onPointerMoveScratchMask = useCallback(
    (e: React.PointerEvent) => {
      if (!scratchDragRef.current) return;
      const pt = getLocalPoint(e.clientX, e.clientY);
      if (!pt) return;
      const last = lastScratchPtRef.current;
      if (last && inCircle(pt.x, pt.y, pt)) {
        eraseScratchSegment(last.x, last.y, pt.x, pt.y);
        scheduleScratchAreaCheck();
      }
      if (inCircle(pt.x, pt.y, pt)) {
        lastScratchPtRef.current = { x: pt.x, y: pt.y };
      }
    },
    [eraseScratchSegment, scheduleScratchAreaCheck],
  );

  const onPointerUpScratchMask = useCallback((e: React.PointerEvent) => {
    scratchDragRef.current = false;
    lastScratchPtRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  /** 镜面外框直径：有上限 + 不超过 78vw，拉宽窗口时镜面不再变大，两侧留白 */
  const mirrorSizeClass = "aspect-square w-[min(72vmin,440px,78vw)]";
  /** 预览区域宽度：约为镜面直径 2 倍，用于“更宽的背景渲染舞台” */
  const previewStageClass = "w-[min(98vw,900px)]";
  /** 底部操作区背景约为镜面直径的 2 倍；并为卡片保留左右各 48px 安全边距 */
  const controlsMaxClass = "w-[min(880px,calc(100vw-96px))]";

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-950">
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mirrorBgSrc}
          alt=""
          referrerPolicy={mirrorBgSrc.includes("pinimg.com") ? "no-referrer" : undefined}
          className="absolute inset-0 h-full w-full min-h-full min-w-full object-cover object-center brightness-[0.78] contrast-[1.05]"
          onError={() => {
            setMirrorBgSrc((cur) => (cur === STREET_FALLBACK_SRC ? cur : STREET_FALLBACK_SRC));
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"
          aria-hidden
        />
      </div>

      <button
        type="button"
        onClick={rotateBackground}
        className="fixed left-[max(14px,env(safe-area-inset-left,0px))] top-[max(14px,env(safe-area-inset-top,0px))] z-30 grid h-9 w-9 place-items-center rounded-full bg-black/38 text-sm text-white/92 ring-1 ring-white/24 backdrop-blur-sm transition hover:bg-black/52"
        title="随机替换背景"
        aria-label="随机替换背景"
      >
        🔀
      </button>

      {/* 金属立柱：GIF(z-0) 之上、镜面(z-2) 之下；fixed 居中，底部伸出视口外不露出柱底 */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 z-[1] w-[min(8.7vw,34px)] max-w-[2.2rem] -translate-x-1/2"
        style={{
          top: "clamp(10.5rem, 33vh, 21rem)",
          bottom: "-28vh",
        }}
      >
        <div
          className="absolute inset-0 rounded-[min(6px,0.8vw)] shadow-[inset_2px_0_10px_rgba(255,255,255,0.2),inset_-2px_0_12px_rgba(0,0,0,0.4),inset_0_-8px_18px_rgba(0,0,0,0.28)]"
          style={{
            background: `linear-gradient(
              90deg,
              #15171c 0%,
              #2a2d35 14%,
              #606674 30%,
              #aeb5c2 46%,
              #d5dbe5 52%,
              #9fa7b3 60%,
              #5b606d 74%,
              #2f323a 88%,
              #17191e 100%
            )`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-[22%] w-[28%] rounded-full bg-gradient-to-b from-white/28 via-white/10 to-transparent opacity-90"
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-6 pb-[36px] pt-14 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] sm:pl-[max(2rem,env(safe-area-inset-left,0px))] sm:pr-[max(2rem,env(safe-area-inset-right,0px))] md:pl-[max(2.75rem,env(safe-area-inset-left,0px))] md:pr-[max(2.75rem,env(safe-area-inset-right,0px))]">
        <div className={`flex ${previewStageClass} flex-col items-center`}>
        <div className={`relative z-[2] -translate-y-[40px] ${mirrorSizeClass}`}>
          <div
            className="absolute inset-0 rounded-full p-[10px] shadow-[0_28px_80px_rgba(0,0,0,0.55)] md:p-[12px]"
            style={{
              background: `linear-gradient(145deg, #3d0000 0%, ${LENS_RIM} 42%, #3a0505 100%)`,
              boxShadow:
                "0 28px 80px rgba(0,0,0,0.55), inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -18px 32px rgba(0,0,0,0.45)",
            }}
          >
            <div
              ref={wrapRef}
              className="relative h-full w-full overflow-hidden rounded-full bg-neutral-900 shadow-[inset_0_0_48px_rgba(0,0,0,0.65)]"
              style={{
                cursor: tool === "sticker" ? "copy" : tool === "draw" ? "crosshair" : "default",
              }}
            >
              {showDefaultLens && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(circle at 42% 34%, rgba(245,245,246,0.95) 0%, rgba(223,223,225,0.92) 30%, rgba(176,177,181,0.9) 68%, rgba(136,137,142,0.95) 100%),
                      radial-gradient(circle at 52% 52%, transparent 58%, rgba(68,69,74,0.18) 100%)
                    `,
                  }}
                />
              )}
              <canvas
                ref={glCanvasRef}
                className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-200 ${
                  isLiveLens ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{
                  touchAction: "none",
                  pointerEvents:
                    tool === "sticker" || scratchPhase === "erasing" ? "none" : "auto",
                }}
              />
              <canvas
                ref={scratchMaskCanvasRef}
                className={`absolute inset-0 z-[5] h-full w-full touch-none transition-opacity duration-150 ${
                  scratchPhase === "erasing" ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{
                  pointerEvents: scratchPhase === "erasing" ? "auto" : "none",
                }}
                onPointerDown={onPointerDownScratchMask}
                onPointerMove={onPointerMoveScratchMask}
                onPointerUp={onPointerUpScratchMask}
                onPointerLeave={onPointerUpScratchMask}
              />
              {!isLiveLens && tool === "none" && scratchPhase === "off" && (
                <div
                  className="absolute inset-0 z-[9] cursor-cell rounded-full touch-none"
                  aria-hidden
                  onPointerDown={onScratchEntryPointerDown}
                />
              )}
              <video
                ref={videoRef}
                className="pointer-events-none absolute h-px w-px opacity-0"
                playsInline
                muted
              />
              <canvas
                ref={drawCanvasRef}
                className="absolute inset-0 h-full w-full"
                style={{
                  touchAction: "none",
                  pointerEvents: tool === "draw" ? "auto" : "none",
                }}
                onPointerDown={onPointerDownDraw}
                onPointerMove={onPointerMoveDraw}
                onPointerUp={onPointerUpDraw}
                onPointerLeave={onPointerUpDraw}
              />

              <div
                className="pointer-events-none absolute inset-0 rounded-full mix-blend-soft-light"
                style={{
                  background:
                    "radial-gradient(ellipse 85% 55% at 32% 28%, rgba(255,255,255,0.5) 0%, transparent 42%), radial-gradient(circle at 50% 50%, transparent 48%, rgba(0,0,0,0.22) 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  boxShadow:
                    "inset 0 0 60px rgba(0,0,0,0.45), inset 0 12px 40px rgba(255,255,255,0.06)",
                }}
              />

              {tool === "sticker" && (
                <div
                  className="absolute inset-0 z-[12] rounded-full"
                  style={{ touchAction: "none" }}
                  aria-hidden
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    placeStickerAtClient(e.clientX, e.clientY);
                  }}
                />
              )}

              <div
                className="pointer-events-none absolute inset-0 z-[18]"
                style={{ perspective: "880px", perspectiveOrigin: "50% 50%" }}
              >
                <AnimatePresence>
                  {stickers.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={springProminent}
                      className={`pointer-events-auto absolute z-20 flex h-11 w-11 cursor-grab select-none items-center justify-center rounded-xl text-2xl shadow-lg active:cursor-grabbing md:h-12 md:w-12 md:text-[1.65rem] ${
                        grippedStickerId === s.id
                          ? "ring-2 ring-amber-300/80 ring-offset-2 ring-offset-transparent"
                          : ""
                      }`}
                      style={{
                        left: `${s.nx * 100}%`,
                        top: `${s.ny * 100}%`,
                        transform: stickerMirrorTransform(s.nx, s.ny, s.scale, pressSnap),
                        transformOrigin: "center center",
                        transformStyle: "preserve-3d",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.button !== 0) return;
                        setGrippedStickerId(s.id);
                        dragStickerRef.current = {
                          id: s.id,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          nx0: s.nx,
                          ny0: s.ny,
                        };
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                      onPointerUp={(e) => {
                        try {
                          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                        } catch {
                          /* ignore */
                        }
                        if (dragStickerRef.current?.id === s.id) dragStickerRef.current = null;
                        setGrippedStickerId(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        removeSticker(s.id);
                      }}
                      onWheel={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const k = Math.exp(-e.deltaY * 0.0014);
                        setStickers((prev) =>
                          prev.map((x) =>
                            x.id === s.id
                              ? { ...x, scale: Math.max(0.35, Math.min(3.2, x.scale * k)) }
                              : x,
                          ),
                        );
                      }}
                    >
                      <span className="pointer-events-none drop-shadow-lg">{s.glyph}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          layout
          transition={springProminent}
          className={`fixed bottom-[max(36px,env(safe-area-inset-bottom,0px))] left-1/2 z-20 -translate-x-1/2 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 shadow-xl backdrop-blur-md ${controlsMaxClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 pb-2">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springTap}
              onClick={() => (cameraOn ? stopCamera() : startCamera("button"))}
              className="rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/18"
            >
              {cameraOn ? "📷 关闭" : "📷 开启"}
            </motion.button>
            <label className="cursor-pointer rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/18">
              🖼 上传
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springTap}
              onClick={resetLens}
              className="rounded-full bg-white/8 px-3.5 py-1.5 text-sm font-medium text-white/85 ring-1 ring-white/12 hover:bg-white/14"
              title="重置"
              aria-label="重置"
            >
              ↺
            </motion.button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(
                [
                  { id: "draw" as const, label: "✎", tip: "编辑" },
                  { id: "sticker" as const, label: "★", tip: "贴纸" },
                ] satisfies { id: Exclude<Tool, "none">; label: string; tip: string }[]
              ).map((t) => (
                <motion.button
                  key={t.id}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  transition={springTap}
                  onClick={() => setTool(tool === t.id ? "none" : t.id)}
                  title={t.tip}
                  aria-label={t.tip}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors ${
                    tool === t.id
                      ? "bg-[#570000]/92 text-white ring-[#7a0d0d]/60"
                      : "bg-white/10 text-white/85 ring-white/12 hover:bg-white/16"
                  }`}
                >
                  {t.label}
                </motion.button>
              ))}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={springTap}
                onClick={clearMirrorDecor}
                className="rounded-full bg-white/8 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/14"
                title="清除"
                aria-label="清除"
              >
                ⌫
              </motion.button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-1 text-sm text-white/75">
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-left">鱼眼强度</span>
              <input
                type="range"
                min={0.35}
                max={1.25}
                step={0.01}
                value={distortion}
                onChange={(e) => setDistortion(Number(e.target.value))}
                className="ui-slider w-full"
              />
            </div>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-left" title="偏小更易拍全身，偏大更近特写">
                视野 / 焦距
              </span>
              <input
                type="range"
                min={0.3}
                max={0.72}
                step={0.01}
                value={fieldZoom}
                onChange={(e) => setFieldZoom(Number(e.target.value))}
                className="ui-slider w-full"
              />
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {tool === "sticker" && (
              <motion.div
                key="sticker-panel"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={springProminent}
                className="flex flex-col gap-1.5 border-t border-white/10 pt-2"
              >
                <div className="flex flex-wrap gap-1">
                  {STICKER_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setStickerPick(g)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                        stickerPick === g ? "bg-white/20 ring-1 ring-[#570000]/75" : "bg-white/8 hover:bg-white/14"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {tool === "draw" && (
              <motion.div
                key="draw-panel"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={springProminent}
                className="border-t border-white/10 pt-2 text-sm text-white/75"
              >
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
                  <span className="text-left">笔触色相</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={brushHue}
                    onChange={(e) => setBrushHue(Number(e.target.value))}
                    className="ui-slider w-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {uploadError && (
            <p className="w-full text-center text-sm text-amber-200/95">{uploadError}</p>
          )}
          {tool === "sticker" && (
            <p className="pt-1 text-[11px] text-white/28">
              点在圆内放置 · 拖动移动 · 滚轮缩放 · 双击删除 · 按住时描边、松手即消
            </p>
          )}
        </motion.div>
        </div>
      </div>
      <style jsx>{`
        .ui-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border: 0;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.22);
          outline: none;
        }
        .ui-slider:hover {
          background: rgba(255, 255, 255, 0.22);
        }
        .ui-slider:focus {
          outline: none;
        }
        .ui-slider::-webkit-slider-runnable-track {
          height: 4px;
          border: 0;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.22);
        }
        .ui-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          margin-top: -4px;
          border: 0;
          border-radius: 9999px;
          background: #570000;
          box-shadow: none;
        }
        .ui-slider::-moz-range-track {
          height: 4px;
          border: 0;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.22);
        }
        .ui-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: 0;
          border-radius: 9999px;
          background: #570000;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
