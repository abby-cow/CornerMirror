"use client";

import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useAnimationControls, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";

import dance4Webp from "../dance 4.webp";
import dance3Webp from "../dance 3.webp";
import dance4Jpg from "../dance 4.jpg";
import dance2Webp from "../dance 2.webp";
import danceWebp from "../dance.webp";
import dance3Jpg from "../dance 3.jpg";
import dance2Jpg from "../dance 2.jpg";
import danceJpg from "../dance.jpg";
import classCountTile from "../上课次数元素.png";
import genreFavoriteBg from "../最喜欢的舞种背景图.png";
import { FADE_UP_VARIANTS, SPRING_RESPONSIVE, SPRING_STANDARD } from "../lib/motion-presets";

const FONT_CN = "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const FONT_SF_ROUNDED = "'SF Compact Rounded','SF Pro Rounded','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const FONT_SF_DISPLAY = "'SF Pro Display','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const FONT_BRADLEY = "'Bradley Hand','Snell Roundhand','Marker Felt',cursive";
/** 设计稿：次要说明 12 / 60% / 500 / lh20 */
const CAPTION_MUTED = "text-[12px] font-medium leading-[20px] text-black/[0.6]";
const SUMMARY_VALUE = "text-[24px] font-medium leading-[32px] text-black";
const PRIMARY = "#B0C16D";
const GRID_IDLE = "#E6E8E5";

/**
 * app/ 下 dance* 素材；叠层最上层（第 8 张）固定为 dance 3.webp。
 */
const PHOTO_POOL = [
  dance4Webp.src,
  dance4Jpg.src,
  dance2Webp.src,
  danceWebp.src,
  dance3Jpg.src,
  dance2Jpg.src,
  danceJpg.src,
  dance3Webp.src,
] as const;

/** 与首页 `home-calendar` 一致的状态栏示意 */
const IMG_STATUS_BATTERY = "https://www.figma.com/api/mcp/asset/53c5dfa3-d33b-43dc-b44c-b2f9d3d49b96";
const IMG_STATUS_WIFI = "https://www.figma.com/api/mcp/asset/649858e2-3758-46e1-b35f-14ddc7183c24";
const IMG_STATUS_SIGNAL = "https://www.figma.com/api/mcp/asset/9544f075-169d-4180-ad39-0e3ff3dd7e6b";

/** 与首页内容区一致：状态栏 44px + 顶部安全区 */
const SAFE_TOP = "calc(44px + max(env(safe-area-inset-top), 8px))";
const MOOD_GROUP_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function RhythmButton(props: {
  className: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
  type?: "button" | "submit" | "reset";
}) {
  const controls = useAnimationControls();

  async function handleTap() {
    await controls.start({
      scale: [1, 0.9, 1.1, 1],
      transition: {
        duration: 0.34,
        times: [0, 0.25, 0.7, 1],
        ease: "easeOut",
      },
    });
  }

  return (
    <motion.button
      type={props.type ?? "button"}
      onClick={props.onClick}
      onTap={handleTap}
      animate={controls}
      className={props.className}
      style={props.style}
      aria-label={props.ariaLabel}
      transition={SPRING_RESPONSIVE}
    >
      {props.children}
    </motion.button>
  );
}

function AnimatedCard(props: { className: string; children: ReactNode; layoutId?: string; disableIntro?: boolean }) {
  if (props.disableIntro) {
    return <section className={props.className}>{props.children}</section>;
  }
  return (
    <motion.section
      layout
      layoutId={props.layoutId}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={FADE_UP_VARIANTS}
      transition={SPRING_STANDARD}
      className={props.className}
    >
      {props.children}
    </motion.section>
  );
}

function RollingNumber(props: {
  value: number;
  className: string;
  style?: CSSProperties;
  triggerKey: string;
  delaySec?: number;
  enabled?: boolean;
}) {
  if (props.enabled === false) {
    return (
      <span className={props.className} style={props.style}>
        {props.value}
      </span>
    );
  }
  const raw = useMotionValue(props.value);
  const spring = useSpring(raw, {
    stiffness: 120,
    damping: 18,
    mass: 1,
  });
  const [display, setDisplay] = useState(props.value);

  useMotionValueEvent(spring, "change", (v) => {
    setDisplay(Math.max(0, Math.round(v)));
  });

  useEffect(() => {
    const delaySec = props.delaySec ?? 0.38;
    const currentRounded = Math.round(raw.get());
    // 即便目标值与当前值相同，也制造一个很小的“滚动过程”，避免看起来没动画
    if (currentRounded === props.value) {
      raw.set(Math.max(0, props.value - 1));
    }

    const controls = animate(raw, props.value, {
      type: "spring",
      stiffness: 120,
      damping: 18,
      mass: 1,
      delay: delaySec,
    });
    return () => controls.stop();
  }, [props.value, props.triggerKey, props.delaySec, raw]);

  return (
    <span className={props.className} style={props.style}>
      {display}
    </span>
  );
}

function StatusBarMock() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-white">
      <div className="mx-auto flex h-[44px] w-full max-w-[375px] items-center justify-between px-[21px]">
        <span
          className="text-[15px] font-medium leading-[18px] text-black"
          style={{ fontFamily: FONT_SF_DISPLAY }}
        >
          21:41
        </span>
        <div className="flex items-center gap-[6px]">
          <img src={IMG_STATUS_SIGNAL} alt="" className="block h-[10px] w-[17px] object-contain object-center" />
          <img src={IMG_STATUS_WIFI} alt="" className="block h-[11px] w-[15px] object-contain object-center" />
          <img src={IMG_STATUS_BATTERY} alt="" className="block h-[11px] w-[24px] object-contain object-center" />
        </div>
      </div>
      <div className="mx-auto h-3 w-full max-w-[375px] bg-white" />
    </div>
  );
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function mondayFirstOffset(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  return (first.getDay() + 6) % 7;
}

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return function next() {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function monthHeatMap(year: number, monthIndex: number): boolean[] {
  const dim = daysInMonth(year, monthIndex);
  const rand = seededRandom(year * 100 + monthIndex);
  const out: boolean[] = [];
  for (let d = 1; d <= dim; d++) {
    out.push(rand() > 0.55);
  }
  return out;
}

type TabKey = "week" | "month" | "year" | "all";

function TabBar(props: { value: TabKey; onChange: (v: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "week", label: "周" },
    { key: "month", label: "月" },
    { key: "year", label: "年" },
    { key: "all", label: "汇总" },
  ];
  return (
    <div className="relative h-9 w-[335px] shrink-0 rounded-[18px] bg-black/[0.04]">
      <div className="absolute left-1 top-1 flex w-[327px] items-center justify-between">
        {tabs.map((t) => {
          const on = props.value === t.key;
          return (
            <motion.button
              key={t.key}
              type="button"
              onClick={() => props.onChange(t.key)}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_RESPONSIVE}
              className={`relative flex h-7 w-[82px] shrink-0 items-center justify-center rounded-[18px] text-[14px] leading-normal ${
                on
                  ? "border-[0.5px] border-black/[0.12] bg-white font-medium text-black"
                  : "bg-transparent font-normal text-black/50"
              }`}
              style={{ fontFamily: FONT_CN }}
            >
              {t.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function MonthLabelCn(year: number, monthIndex: number) {
  return `${year}年${monthIndex + 1}月`;
}

function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date: Date, delta: number) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}

function formatCnDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function weekLabelCn(date: Date) {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return `${formatCnDate(start)} - ${end.getMonth() + 1}月${end.getDate()}日`;
}

function yearLabelCn(date: Date) {
  return `${date.getFullYear()}年`;
}

function periodLabelCn(tab: TabKey, date: Date) {
  if (tab === "week") return weekLabelCn(date);
  if (tab === "month") return MonthLabelCn(date.getFullYear(), date.getMonth());
  if (tab === "year") return yearLabelCn(date);
  return "2019年9月12日至今";
}

function periodSeed(tab: TabKey, date: Date) {
  if (tab === "week") {
    const start = startOfWeek(date);
    return Number(`${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, "0")}${String(start.getDate()).padStart(2, "0")}1`);
  }
  if (tab === "month") return date.getFullYear() * 100 + date.getMonth() + 1;
  if (tab === "year") return date.getFullYear();
  return 999000 + date.getFullYear();
}

/** 总览照片条：每张图为独立 absolute 层（无 flex 负边距嵌套感）；Figma 叠距约 -72px；轨道外扩留白避免首尾旋转裁切。 */
function OverviewPhotoStrip(props: { count: number; motionKey: string; disableIntro?: boolean }) {
  const photoCount = Math.max(1, Math.min(PHOTO_POOL.length, props.count));
  const photos = PHOTO_POOL.slice(0, photoCount);
  const cardW = 90;
  const cardH = 120;
  const n = photos.length;
  // Figma gap -72：相邻卡片左缘间距 = cardW - 72
  const stepPx = cardW - 72;
  const stackWidth = n <= 1 ? cardW : cardW + (n - 1) * stepPx;
  // 左右留白：±6° 裁切；上留白：与上层「课堂记录」行间距稿 16px（外层 gap 2px + 本处 top 14px）
  const bleedX = 22;
  const bleedYTop = 14;
  /** 底贴齐卡片下缘，使到「更多视频或照片」为外层 12px，避免再叠一层与稿面不符的底留白 */
  const bleedYBottom = 0;
  const trackW = bleedX * 2 + stackWidth;
  const trackH = bleedYTop + cardH + bleedYBottom;

  function finalRotationDeg(i: number) {
    if (n === 1) return 6;
    if (i === 0) return -6;
    if (i === n - 1) return 6;
    return 0;
  }

  return (
    <div className="flex h-[158px] w-full flex-col items-center justify-between">
      <div className="flex h-[134px] w-full justify-center overflow-visible py-0">
        <div className="relative mx-auto h-[134px] shrink-0 overflow-visible" style={{ width: trackW, height: trackH }}>
          {photos.map((src, i) => {
            const finalDeg = finalRotationDeg(i);
            // 改为左->右依次出现：除第一张外，其余卡从右向左轻柔归位
            const introX = i === 0 ? 0 : 12 + (n - 1 - i) * 5;
            const introY = i === 0 ? 0 : -2 - (n - 1 - i) * 0.35;
            const introScale = i === 0 ? 1 : 1.008;
            const introRotate = i === 0 ? finalDeg : finalDeg + 1.2;
            // 从左到右依次进入，保持弱弹性和渐缓
            const settleDelay = i * 0.06;
            const settleStiffness = 90;
            const settleDamping = 30;

            if (props.disableIntro) {
              return (
                <div
                  key={`${props.motionKey}-${src}-${String(i)}`}
                  className="absolute"
                  style={{
                    left: bleedX + i * stepPx,
                    top: bleedYTop,
                    width: cardW,
                    height: cardH,
                    zIndex: i + 1,
                    transformOrigin: "50% 80%",
                    willChange: "transform",
                    transform: `rotate(${finalDeg}deg)`,
                  }}
                >
                  <div className="box-border h-full w-full overflow-hidden rounded-lg bg-white shadow-none" style={{ border: "2px solid #ffffff" }}>
                    <img src={src} alt="" className="pointer-events-none block h-full w-full object-cover object-center" />
                  </div>
                </div>
              );
            }

            return (
            <motion.div
              key={`${props.motionKey}-${src}-${String(i)}`}
              className="absolute"
              initial={{
                x: introX,
                y: introY,
                scale: introScale,
                rotate: introRotate,
                opacity: 1,
              }}
              animate={{
                x: 0,
                y: 0,
                scale: 1,
                rotate: finalDeg,
                opacity: 1,
              }}
              transition={{
                x: { type: "spring", stiffness: settleStiffness, damping: settleDamping, mass: 1 },
                y: { type: "spring", stiffness: settleStiffness, damping: settleDamping, mass: 1 },
                scale: { type: "spring", stiffness: settleStiffness, damping: settleDamping, mass: 1 },
                rotate: { type: "spring", stiffness: settleStiffness, damping: settleDamping, mass: 1 },
                delay: settleDelay,
              }}
              style={{
                left: bleedX + i * stepPx,
                top: bleedYTop,
                width: cardW,
                height: cardH,
                zIndex: i + 1,
                transformOrigin: "50% 80%",
                willChange: "transform",
              }}
            >
              {/* 固定 2px 白描边（字面 2px，避免与 Tailwind 边框类混用产生粗细差）；圆角与裁切同层；无投影 */}
              <div
                className="box-border h-full w-full overflow-hidden rounded-lg bg-white shadow-none"
                style={{ border: "2px solid #ffffff" }}
              >
                <img
                  src={src}
                  alt=""
                  className="pointer-events-none block h-full w-full object-cover object-center"
                />
              </div>
            </motion.div>
          )})}
        </div>
      </div>
      <RhythmButton
        className="flex h-4 items-center gap-0.5 text-[12px] font-normal leading-normal text-black/40"
        style={{ fontFamily: FONT_SF_ROUNDED }}
      >
        更多视频或照片
        <span className="text-[12px] font-normal leading-none opacity-40" aria-hidden>
          ›
        </span>
      </RhythmButton>
    </div>
  );
}

function PeriodActivityGrid(props: { tab: TabKey; date: Date }) {
  const seed = periodSeed(props.tab, props.date);
  const rand = seededRandom(seed + 401);
  const isDenseGrid = props.tab === "year" || props.tab === "all";

  const layout = useMemo(() => {
    if (props.tab === "week") {
      const active = Array.from({ length: 7 }, () => rand() > 0.45);
      return {
        columns: 7,
        items: active.map((on, i) => ({ key: `week-${i}`, active: on })),
      };
    }

    if (props.tab === "year") {
      const active = Array.from({ length: 20 * 19 }, () => rand() > 0.62);
      return {
        columns: 20,
        items: active.map((on, i) => ({ key: `year-${i}`, active: on })),
      };
    }

    if (props.tab === "all") {
      const active = Array.from({ length: 20 * 19 }, () => rand() > 0.58);
      return {
        columns: 20,
        items: active.map((on, i) => ({ key: `all-${i}`, active: on })),
      };
    }

    const year = props.date.getFullYear();
    const monthIndex = props.date.getMonth();
    const dim = daysInMonth(year, monthIndex);
    const offset = mondayFirstOffset(year, monthIndex);
    const heat = monthHeatMap(year, monthIndex);
    const totalCells = Math.ceil((offset + dim) / 7) * 7;
    return {
      columns: 7,
      items: Array.from({ length: totalCells }, (_, idx) => {
        const day = idx - offset + 1;
        if (day < 1 || day > dim) return { key: `empty-${idx}`, active: false, empty: true };
        return { key: `month-${day}`, active: heat[day - 1] };
      }),
    };
  }, [props.tab, props.date, rand]);

  // 绿色格子按当前时间维度做稳定“随机顺序”点亮
  const activeKeys = layout.items.filter((c) => c.active).map((c) => c.key);
  const activeOrderMap = useMemo(() => {
    const shuffled = [...activeKeys];
    const rand = seededRandom(seed + 701);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const map = new Map<string, number>();
    shuffled.forEach((key, idx) => map.set(key, idx));
    return map;
  }, [activeKeys, seed]);

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: isDenseGrid
          ? "repeat(20, minmax(0, calc((100% - 76px) / 20)))"
          : `repeat(${layout.columns}, minmax(0, 24px))`,
        gap: isDenseGrid ? "4px" : undefined,
      }}
    >
      {layout.items.map((c) => {
        if ("empty" in c && c.empty) {
          return <div key={c.key} className={isDenseGrid ? "aspect-square w-full rounded-[4px]" : "h-6 w-6 rounded"} />;
        }
        const rank = activeOrderMap.get(c.key) ?? 0;
        return (
          <motion.div
            key={c.key}
            className={isDenseGrid ? "aspect-square w-full rounded-[4px]" : "h-6 w-6 rounded"}
            initial={{ backgroundColor: GRID_IDLE }}
            animate={{ backgroundColor: c.active ? PRIMARY : GRID_IDLE }}
            transition={{
              duration: c.active ? 0.32 : 0.2,
              ease: "easeOut",
              delay: c.active ? 0.58 + rank * 0.055 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

type GenreRow = { name: string; count: number };
type KeywordTone = "dark" | "green";
type KeywordItem = { text: string; tone: KeywordTone };

type MonthSummaryMock = {
  classRecords: number;
  elementRecords: number;
  danceDays: number;
  courseCount: number;
  totalMinutes: number;
  genreRows: GenreRow[];
  learnedElements: string[];
  longestMinutes: number;
  studioName: string;
  teacherName: string;
  keywords: KeywordItem[];
  photoCount: number;
};

function GenreProportionRow(props: { row: GenreRow; maxCount: number }) {
  const maxIcons = 12;
  const n = Math.max(1, Math.round((props.row.count / props.maxCount) * maxIcons));
  const shown = Math.min(maxIcons, n);
  return (
    <div className="flex w-full items-center justify-end gap-1">
      <div className="flex max-w-[142px] flex-wrap justify-end gap-0.5">
        {Array.from({ length: shown }).map((_, i) => (
          <img
            key={i}
            src={classCountTile.src}
            alt=""
            width={30}
            height={61}
            decoding="async"
            className="pointer-events-none block h-5 w-2.5 shrink-0 rounded-[1px] object-cover object-center"
          />
        ))}
      </div>
      <div
        className="w-[54px] max-w-[54px] shrink-0 text-right text-[12px] font-normal leading-normal text-black/60"
        style={{ fontFamily: FONT_SF_ROUNDED }}
      >
        {props.row.name}
      </div>
    </div>
  );
}

const GENRE_POOL = ["Hiphop", "编舞", "jazz", "Kpop", "Urban", "Popping"] as const;
const ELEMENT_POOL = [
  "Reebok",
  "Smurf",
  "Patty Duke",
  "Wop",
  "Wutang",
  "Groove",
  "Scoobot",
  "Toyman",
] as const;
const STUDIO_POOL = ["X-Dance", "D-Lab", "MoveOn", "StepUp"] as const;
const TEACHER_POOL = ["xiaoku", "Miya", "Aken", "Lulu"] as const;
const KEYWORD_POOL = [
  "爆发力",
  "身体记忆",
  "isolation",
  "开窍",
  "找到感觉",
  "框架",
  "动作细节",
  "律动",
  "卡点",
  "控制",
] as const;

function pickUnique<T>(items: readonly T[], count: number, rand: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length && out.length < count) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function formatDurationMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

function buildSummaryMock(tab: TabKey, date: Date): MonthSummaryMock {
  const seed = periodSeed(tab, date);
  const rand = seededRandom(seed + 903);
  const ranges =
    tab === "week"
      ? { classBase: 2, classSpan: 5, elementBase: 1, elementSpan: 4, daysMax: 7, coursesAdd: 1, coursesSpan: 4, minuteBase: 45, minuteSpan: 26, longestBase: 90, longestSpan: 210, photoBase: 1, photoSpan: 4 }
      : tab === "year"
      ? { classBase: 120, classSpan: 60, elementBase: 40, elementSpan: 30, daysMax: 365, coursesAdd: 18, coursesSpan: 40, minuteBase: 55, minuteSpan: 36, longestBase: 240, longestSpan: 480, photoBase: 5, photoSpan: 4 }
      : tab === "all"
      ? { classBase: 260, classSpan: 90, elementBase: 90, elementSpan: 40, daysMax: 999, coursesAdd: 36, coursesSpan: 70, minuteBase: 58, minuteSpan: 42, longestBase: 300, longestSpan: 600, photoBase: 6, photoSpan: 3 }
      : { classBase: 8, classSpan: 8, elementBase: 4, elementSpan: 8, daysMax: daysInMonth(date.getFullYear(), date.getMonth()), coursesAdd: 2, coursesSpan: 8, minuteBase: 50, minuteSpan: 31, longestBase: 180, longestSpan: 360, photoBase: 4, photoSpan: 5 };

  const classRecords = ranges.classBase + Math.floor(rand() * ranges.classSpan);
  const elementRecords = ranges.elementBase + Math.floor(rand() * ranges.elementSpan);

  const estimatedActive =
    tab === "week" ? 3 + Math.floor(rand() * 4) : tab === "year" ? 80 + Math.floor(rand() * 120) : tab === "all" ? 180 + Math.floor(rand() * 220) : monthHeatMap(date.getFullYear(), date.getMonth()).filter(Boolean).length;
  const danceDays = Math.max(1, Math.min(ranges.daysMax, estimatedActive + Math.floor(rand() * 5) - 2));
  const courseCount = classRecords + ranges.coursesAdd + Math.floor(rand() * ranges.coursesSpan);
  const totalMinutes = courseCount * (ranges.minuteBase + Math.floor(rand() * ranges.minuteSpan));

  const genreNames = pickUnique(GENRE_POOL, 4, rand);
  const topGenreCount = 24 + Math.floor(rand() * 28); // 24..51
  const genreRows: GenreRow[] = [
    { name: genreNames[0], count: topGenreCount },
    { name: genreNames[1], count: Math.max(8, Math.floor(topGenreCount * (0.56 + rand() * 0.12))) },
    { name: genreNames[2], count: Math.max(6, Math.floor(topGenreCount * (0.36 + rand() * 0.1))) },
    { name: genreNames[3], count: Math.max(4, Math.floor(topGenreCount * (0.22 + rand() * 0.1))) },
  ];

  const learnedCount = (tab === "year" || tab === "all" ? 6 : 4) + Math.floor(rand() * 4);
  const learnedElements = pickUnique(ELEMENT_POOL, learnedCount, rand);
  const longestMinutes = ranges.longestBase + Math.floor(rand() * ranges.longestSpan);
  const studioName = STUDIO_POOL[Math.floor(rand() * STUDIO_POOL.length)];
  const teacherName = TEACHER_POOL[Math.floor(rand() * TEACHER_POOL.length)];

  const keywordCount = 7 + Math.floor(rand() * 2); // 7..8
  const keywords = pickUnique(KEYWORD_POOL, keywordCount, rand).map((text, i) => ({
    text,
    tone: ((i + Math.floor(rand() * 2)) % 2 === 0 ? "dark" : "green") as KeywordTone,
  }));

  const photoCount = ranges.photoBase + Math.floor(rand() * ranges.photoSpan);

  return {
    classRecords,
    elementRecords,
    danceDays,
    courseCount,
    totalMinutes,
    genreRows,
    learnedElements,
    longestMinutes,
    studioName,
    teacherName,
    keywords,
    photoCount,
  };
}

export default function DanceSummaryPage() {
  const router = useRouter();
  const [pageExit, setPageExit] = useState(false);
  const now = new Date();
  const [tab, setTab] = useState<TabKey>("month");
  const [cursorDate, setCursorDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  const summary = useMemo(() => buildSummaryMock(tab, cursorDate), [tab, cursorDate]);
  const maxGenre = Math.max(...summary.genreRows.map((r) => r.count));
  const keywordsRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: keywordsProgress } = useScroll({
    target: keywordsRef,
    offset: ["start end", "end start"],
  });
  const keywordsBgY = useTransform(keywordsProgress, [0, 1], [-8, 8]);
  const keywordsFgY = useTransform(keywordsProgress, [0, 1], [-10, 10]);

  function shiftMonth(delta: number) {
    setCursorDate((prev) => {
      if (tab === "week") return addDays(prev, delta * 7);
      if (tab === "year") return new Date(prev.getFullYear() + delta, prev.getMonth(), 1);
      if (tab === "all") return prev;
      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
    });
  }

  function goHome() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "back");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/"), 220);
  }

  const navDirection = typeof window !== "undefined" ? window.sessionStorage.getItem("page-nav-direction") : null;
  const suppressCrossPageEntryMotion = navDirection === "forward";
  const initialX = navDirection === "forward" ? 22 : -22;
  if (typeof window !== "undefined" && !pageExit) {
    window.sessionStorage.removeItem("page-nav-direction");
  }

  return (
    <motion.main
      className="min-h-screen bg-[#FEFEFE] text-zinc-900"
      style={{ fontFamily: FONT_CN }}
      initial={{ x: initialX, opacity: 0.01 }}
      animate={pageExit ? { x: 22, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <StatusBarMock />
      <div className="mx-auto w-full max-w-[375px] pb-28">
        <div className="px-5 pb-5" style={{ paddingTop: SAFE_TOP }}>
          <div
            className="sticky z-40 -mx-5 bg-[#FEFEFE] px-5 pb-3 pt-1"
            style={{ top: SAFE_TOP }}
          >
            <header className="flex h-10 items-center justify-between gap-2 px-0">
              <button type="button" onClick={goHome} className="grid h-6 w-6 shrink-0 place-items-center text-[#323233]" aria-label="返回">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M7.02008 11.772C7.06328 11.5896 7.15448 11.424 7.28648 11.292L15.3001 3.276C15.6913 2.8848 16.3249 2.8848 16.7137 3.276C17.1025 3.6672 17.1049 4.3008 16.7137 4.6896L9.40568 12L16.7137 19.3104C17.1049 19.7016 17.1049 20.3352 16.7137 20.724C16.3225 21.1152 15.6889 21.1152 15.3001 20.724L7.28648 12.7104C7.03208 12.456 6.94328 12.0984 7.02008 11.772Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <h1
                className="flex-1 text-center text-[18px] font-medium leading-normal text-black"
                style={{ fontFamily: FONT_CN }}
              >
                跳舞记录分析
              </h1>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-90" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20.5 12.75C20.1 12.75 19.75 13.1 19.75 13.5V19.5C19.75 19.65 19.65 19.75 19.5 19.75H4.5C4.35 19.75 4.25 19.65 4.25 19.5V4.5C4.25 4.35 4.35 4.25 4.5 4.25H10.5C10.9 4.25 11.25 3.9 11.25 3.5C11.25 3.1 10.9 2.75 10.5 2.75H4.5C3.55 2.75 2.75 3.55 2.75 4.5V19.5C2.75 20.45 3.55 21.25 4.5 21.25H19.5C20.45 21.25 21.25 20.45 21.25 19.5V13.5C21.25 13.1 20.9 12.75 20.5 12.75Z"
                    fill="black"
                    fillOpacity="0.9"
                  />
                  <path
                    d="M20.5001 2.75H15.0001C14.6001 2.75 14.2501 3.1 14.2501 3.5C14.2501 3.9 14.6001 4.25 15.0001 4.25H18.7001L11.9501 10.95C11.6501 11.25 11.6501 11.7 11.9501 12C12.1001 12.15 12.3001 12.2 12.5001 12.2C12.7001 12.2 12.9001 12.15 13.0501 12L19.7501 5.3V9C19.7501 9.4 20.1001 9.75 20.5001 9.75C20.9001 9.75 21.2501 9.4 21.2501 9V3.5C21.2501 3.1 20.9001 2.75 20.5001 2.75Z"
                    fill="black"
                    fillOpacity="0.9"
                  />
                </svg>
              </span>
            </header>

            <div className="mt-4 flex justify-center">
              <TabBar value={tab} onChange={setTab} />
            </div>
          </div>

          <div className="mt-1 flex w-full items-center justify-start gap-1 py-2">
            {tab !== "all" ? (
              <RhythmButton
                className="grid h-6 w-6 place-items-center text-black/60"
                onClick={() => shiftMonth(-1)}
                ariaLabel="上一周期"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3.50992 6.114C3.53152 6.2052 3.57712 6.288 3.64312 6.354L7.64992 10.362C7.84552 10.5576 8.16232 10.5576 8.35672 10.362C8.55112 10.1664 8.55232 9.8496 8.35672 9.6552L4.70272 6L8.35672 2.3448C8.55232 2.1492 8.55232 1.8324 8.35672 1.638C8.16112 1.4424 7.84432 1.4424 7.64992 1.638L3.64312 5.6448C3.51592 5.772 3.47152 5.9508 3.50992 6.114Z"
                    fill="black"
                    fillOpacity="0.6"
                  />
                </svg>
              </RhythmButton>
            ) : null}
            <span className="text-[14px] font-medium leading-[20px] text-black/60" style={{ fontFamily: FONT_CN }}>
              {periodLabelCn(tab, cursorDate)}
            </span>
            {tab !== "all" ? (
              <RhythmButton
                className="grid h-6 w-6 place-items-center text-black/60"
                onClick={() => shiftMonth(1)}
                ariaLabel="下一周期"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M8.49008 6.114C8.46848 6.2052 8.42288 6.288 8.35688 6.354L4.35008 10.362C4.15448 10.5576 3.83768 10.5576 3.64328 10.362C3.44888 10.1664 3.44768 9.8496 3.64328 9.6552L7.29728 6L3.64328 2.3448C3.44768 2.1492 3.44768 1.8324 3.64328 1.638C3.83888 1.4424 4.15568 1.4424 4.35008 1.638L8.35688 5.6448C8.48408 5.772 8.52848 5.9508 8.49008 6.114Z"
                    fill="black"
                    fillOpacity="0.6"
                  />
                </svg>
              </RhythmButton>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col items-center gap-4">
          <AnimatedCard
            className="w-[335px] rounded-xl bg-[#F5F6F3] py-6 pb-7"
            layoutId="summary-overview-card"
            disableIntro={suppressCrossPageEntryMotion}
          >
            <div className="flex flex-col gap-7 px-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 px-5">
                <div className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="flex h-12 w-full items-center justify-center text-center text-[48px] font-bold leading-none text-black"
                    style={{ fontFamily: FONT_BRADLEY }}
                  >
                    <RollingNumber
                      value={summary.classRecords}
                      triggerKey={`${tab}-${periodSeed(tab, cursorDate)}-class`}
                      delaySec={0.2}
                      enabled={!suppressCrossPageEntryMotion}
                      className="inline-block text-[48px] font-bold leading-none text-black"
                      style={{ fontFamily: FONT_BRADLEY }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 0L8.94427 5.09383L12.7023 1.52786L10.4721 6.20389L15.6085 5.52786L11.0557 8L15.6085 10.4721L10.4721 9.79611L12.7023 14.4721L8.94427 10.9062L8 16L7.05573 10.9062L3.29772 14.4721L5.52786 9.79611L0.391548 10.4721L4.94427 8L0.391548 5.52786L5.52786 6.20389L3.29772 1.52786L7.05573 5.09383L8 0Z"
                        fill={PRIMARY}
                      />
                    </svg>
                    <span className="text-[12px] font-normal leading-normal text-black" style={{ fontFamily: FONT_CN }}>
                      课堂记录
                    </span>
                  </div>
                </div>
                <div className="h-6 w-px shrink-0 bg-black/[0.12]" />
                <div className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="flex h-12 w-full items-center justify-center text-[48px] font-bold leading-none text-black"
                    style={{ fontFamily: FONT_BRADLEY }}
                  >
                    <RollingNumber
                      value={summary.elementRecords}
                      triggerKey={`${tab}-${periodSeed(tab, cursorDate)}-element`}
                      delaySec={0.26}
                      enabled={!suppressCrossPageEntryMotion}
                      className="inline-block text-[48px] font-bold leading-none text-black"
                      style={{ fontFamily: FONT_BRADLEY }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M7.06215 2.5345C7.38431 1.66389 8.61569 1.66389 8.93785 2.53451L10.0012 5.40803C10.1024 5.68175 10.3182 5.89756 10.592 5.99885L13.4655 7.06215C14.3361 7.38431 14.3361 8.61569 13.4655 8.93785L10.592 10.0012C10.3182 10.1024 10.1024 10.3182 10.0012 10.592L8.93785 13.4655C8.61569 14.3361 7.38431 14.3361 7.06215 13.4655L5.99885 10.592C5.89756 10.3182 5.68175 10.1024 5.40803 10.0012L2.5345 8.93785C1.66389 8.61569 1.66389 7.38431 2.53451 7.06215L5.40803 5.99885C5.68175 5.89756 5.89756 5.68175 5.99885 5.40803L7.06215 2.5345Z"
                        fill="#BB9D5A"
                      />
                    </svg>
                    <span className="text-[12px] font-normal leading-normal text-black" style={{ fontFamily: FONT_CN }}>
                      元素记录
                    </span>
                  </div>
                </div>
              </div>

                <div className="px-5">
                  <OverviewPhotoStrip
                    count={summary.photoCount}
                    motionKey={`${tab}-${periodSeed(tab, cursorDate)}-${summary.photoCount}`}
                    disableIntro={suppressCrossPageEntryMotion}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 px-5">
                <div className="flex h-[60px] w-full max-w-[335px] flex-col items-center justify-center gap-1.5">
                  <div
                    className="flex w-full flex-wrap items-center justify-center gap-1 text-[12px] font-normal leading-normal text-black"
                    style={{ fontFamily: FONT_CN }}
                  >
                    <span>本月累计跳舞</span>
                    <span
                      className="inline-flex items-center justify-center rounded-md bg-[#EBE6DA] px-2 py-1 text-[16px] font-medium leading-normal text-black"
                      style={{ fontFamily: FONT_SF_ROUNDED }}
                    >
                      {summary.danceDays}天
                    </span>
                    <span>共计</span>
                    <span
                      className="inline-flex items-center justify-center rounded-md bg-[#E8ECDA] px-2 py-1 text-[16px] font-medium leading-normal text-black"
                      style={{ fontFamily: FONT_SF_ROUNDED }}
                    >
                      {summary.courseCount}次课程
                    </span>
                  </div>
                  <div
                    className="flex w-full flex-wrap items-center justify-center gap-1 text-[12px] font-normal leading-normal text-black"
                    style={{ fontFamily: FONT_CN }}
                  >
                    <span>累计练习时间</span>
                    <span
                      className="inline-flex items-center justify-center rounded-md bg-[#F5EBEB] px-2 py-1 text-[16px] font-medium leading-normal text-black"
                      style={{ fontFamily: FONT_SF_ROUNDED }}
                    >
                      {summary.totalMinutes}分钟
                    </span>
                  </div>
                </div>

                <div className="flex w-[216px] flex-col gap-2">
                  <PeriodActivityGrid
                    key={`${tab}-${periodSeed(tab, cursorDate)}`}
                    tab={tab}
                    date={cursorDate}
                  />
                </div>
              </div>
            </div>
          </AnimatedCard>

          {/* 最喜欢的舞种 */}
          <AnimatedCard
            className="w-[335px] overflow-hidden rounded-xl bg-[#F8F8F8] py-4 pb-6"
            layoutId="summary-favorite-genre-card"
            disableIntro={suppressCrossPageEntryMotion}
          >
            <div className={`px-5 ${CAPTION_MUTED}`} style={{ fontFamily: FONT_CN }}>
              最喜欢的舞种是
            </div>
            <div className="mt-2 flex gap-1.5 px-5">
              <div className="min-w-0 flex-1">
                <div className="text-[24px] font-medium leading-[29px] text-black" style={{ fontFamily: FONT_SF_ROUNDED }}>
                  {summary.genreRows[0]?.name ?? "-"}
                </div>
                <div className="text-[24px] font-medium leading-[29px] text-black" style={{ fontFamily: FONT_SF_ROUNDED }}>
                  {summary.genreRows[0]?.count ?? 0}次
                </div>
              </div>
              <div className="flex w-[200px] shrink-0 flex-col items-end gap-2">
                {summary.genreRows.map((row) => (
                  <GenreProportionRow key={row.name} row={row} maxCount={maxGenre} />
                ))}
              </div>
            </div>
          </AnimatedCard>

          {/* 新学习了 */}
          <AnimatedCard
            className="w-[335px] rounded-xl bg-[#F8F8F8] pt-4 pb-6"
            layoutId="summary-learning-card"
            disableIntro={suppressCrossPageEntryMotion}
          >
            <div className={`px-5 ${CAPTION_MUTED}`} style={{ fontFamily: FONT_CN }}>
              新学习了
            </div>
            <div className={`mt-1.5 px-5 ${SUMMARY_VALUE}`} style={{ fontFamily: FONT_SF_ROUNDED }}>
              {summary.learnedElements.length}个基础元素
            </div>
            <div className="mt-4 flex flex-wrap gap-x-1 gap-y-2 px-5">
              {summary.learnedElements.map((name, i) => (
                <span
                  key={name}
                  className={`inline-flex h-12 items-center rounded-[20px] px-4 text-[16px] font-medium text-black ${
                    i === 4 ? "bg-[#EBE6DA]" : i === 5 ? "bg-[#E8ECDA]" : "bg-black/[0.04]"
                  }`}
                  style={{ fontFamily: FONT_CN }}
                >
                  {name}
                </span>
              ))}
            </div>
          </AnimatedCard>

          <div className="flex w-[335px] gap-3">
            <AnimatedCard
              className="flex h-[97px] min-w-0 flex-1 flex-col rounded-xl bg-[#F8F8F8] pt-4 pb-6"
              layoutId="summary-longest-card"
              disableIntro={suppressCrossPageEntryMotion}
            >
              <div className={`px-5 ${CAPTION_MUTED}`} style={{ fontFamily: FONT_CN }}>
                最长单日练习时长
              </div>
              <div className={`mt-1.5 px-5 ${SUMMARY_VALUE}`} style={{ fontFamily: FONT_SF_ROUNDED }}>
                {formatDurationMinutes(summary.longestMinutes)}
              </div>
            </AnimatedCard>
          </div>

          <div className="flex w-[335px] gap-3">
            <AnimatedCard
              className="flex h-[97px] min-w-0 flex-1 flex-col rounded-xl bg-[#F8F8F8] pt-4 pb-6"
              layoutId="summary-studio-card"
              disableIntro={suppressCrossPageEntryMotion}
            >
              <div className={`px-5 ${CAPTION_MUTED}`} style={{ fontFamily: FONT_CN }}>
                最常去的舞房
              </div>
              <div className={`mt-1.5 px-5 ${SUMMARY_VALUE}`} style={{ fontFamily: FONT_SF_ROUNDED }}>
                {summary.studioName}
              </div>
            </AnimatedCard>
            <AnimatedCard
              className="flex h-[97px] min-w-0 flex-1 flex-col rounded-xl bg-[#F8F8F8] pt-4 pb-6"
              layoutId="summary-teacher-card"
              disableIntro={suppressCrossPageEntryMotion}
            >
              <div className={`px-5 ${CAPTION_MUTED}`} style={{ fontFamily: FONT_CN }}>
                最爱的老师是
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 px-5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-200 text-[10px] text-zinc-500">
                  ·
                </span>
                <span className={SUMMARY_VALUE} style={{ fontFamily: FONT_SF_ROUNDED }}>
                  {summary.teacherName}
                </span>
              </div>
            </AnimatedCard>
          </div>

          <div className="flex w-full flex-col items-center gap-2">
            {/* 跳舞心情记录 */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              variants={MOOD_GROUP_VARIANTS}
              transition={{ duration: 0.22, ease: "easeOut", delay: 0.08 }}
              className="flex w-full items-center justify-between py-2"
            >
              <span className="text-[14px] font-medium leading-[20px] text-black" style={{ fontFamily: FONT_CN }}>
                跳舞心情记录
              </span>
              <RhythmButton
                className="flex items-center gap-1 text-[12px] font-normal leading-normal text-black/40"
                style={{ fontFamily: FONT_SF_ROUNDED }}
              >
                查看全部
                <span className="text-[12px] font-normal leading-none opacity-40" aria-hidden>
                  ›
                </span>
              </RhythmButton>
            </motion.div>

            <motion.section
              ref={keywordsRef}
              layout
              layoutId="summary-keywords-card"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              variants={MOOD_GROUP_VARIANTS}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-[335px] overflow-hidden rounded-xl bg-[#F8F8F8] py-4 pb-6"
            >
            <motion.img
              src={genreFavoriteBg.src}
              alt=""
              width={670}
              height={288}
              decoding="async"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-0 block h-auto w-full max-w-none select-none"
              style={{ y: keywordsBgY }}
            />
            <motion.div
              className={`relative z-[1] px-5 ${CAPTION_MUTED}`}
              style={{ fontFamily: FONT_CN, y: keywordsFgY }}
            >
              关键词
            </motion.div>
            <motion.div className="relative z-[1] mt-3 flex flex-col gap-[2px] px-5" style={{ y: keywordsFgY }}>
              {[summary.keywords.slice(0, 3), summary.keywords.slice(3, 6), summary.keywords.slice(6)].map((group, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.2, ease: "easeOut", delay: idx * 0.06 }}
                  className="flex flex-wrap gap-2"
                >
                  {group.map((k) => (
                    <span
                      key={k.text}
                      className={`text-[22px] font-medium leading-[24px] ${
                        k.tone === "green" ? "text-[#87A11F]" : "text-black"
                      }`}
                      style={{ fontFamily: FONT_CN }}
                    >
                      {k.text}
                    </span>
                  ))}
                </motion.div>
              ))}
            </motion.div>
            </motion.section>
          </div>

          </div>
        </div>
      </div>
    </motion.main>
  );
}
