"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import emptyStateIllustration from "./空态插图2.png";
import headerIllustration from "./头部插图.png";
import { SPRING_STANDARD } from "./lib/motion-presets";

type RecordItem = {
  id: string;
  date: string;
  title: string;
  durationLabel?: string;
  subtitle?: string;
  teacher?: string;
  stars?: number;
  note?: string;
  photos?: [string, string] | [string];
  badge?: "课堂记录" | "元素记录";
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const IMG_JAZZ_A = "https://www.figma.com/api/mcp/asset/c03136a5-e063-49d1-924a-4f51aa3fa7ed";
const IMG_JAZZ_B = "https://www.figma.com/api/mcp/asset/4422e965-b699-4264-96c6-36ef0f9513ce";
const IMG_WUTANG_A = "https://www.figma.com/api/mcp/asset/7915e6f4-9842-46aa-9dcd-cb4b550666ef";
const IMG_WUTANG_B = "https://www.figma.com/api/mcp/asset/036ced33-d308-4c93-a424-c0d05746d511";
const IMG_HEADER_ART = headerIllustration.src;
const IMG_STATUS_BATTERY = "https://www.figma.com/api/mcp/asset/53c5dfa3-d33b-43dc-b44c-b2f9d3d49b96";
const IMG_STATUS_WIFI = "https://www.figma.com/api/mcp/asset/649858e2-3758-46e1-b35f-14ddc7183c24";
const IMG_STATUS_SIGNAL = "https://www.figma.com/api/mcp/asset/9544f075-169d-4180-ad39-0e3ff3dd7e6b";
const IMG_CALENDAR_VECTOR = "https://www.figma.com/api/mcp/asset/c03b93a1-911a-487a-939d-ccc0d3bcaed5";
/** Chevron next to Jazz title: pt-1 aligns with 28px title cap height. */
const TITLE_ROW_CHEVRON_CLASS = "pt-1 text-[18px] leading-[18px] text-zinc-400 select-none";
/** Month bar: same color/size as Jazz ›, no pt-1 so arrows sit on optical center with date text. */
const MONTH_NAV_CHEVRON_CLASS = "text-[18px] leading-none text-zinc-400 select-none";
const IMG_EMPTY_STATE = emptyStateIllustration.src;
const PRIMARY_GREEN = "#B0C16D";
const UI_FONT_STACK = "'PingFang SC','SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const FONT_SF_COMPACT = "'SF Compact Display','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const FONT_SF_ROUNDED = "'SF Compact Rounded','SF Pro Rounded','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const FONT_CN = "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const CHECKIN_DRAFT_STORAGE_KEY = "home:new-element-record";

const FADE_SOFT = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.24, ease: "easeOut" as const },
};

function readPendingElementRecordFromSession(): RecordItem | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CHECKIN_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RecordItem;
    if (!parsed?.id || !parsed?.date || !parsed?.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function mondayFirstIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function monthLabel(year: number, monthIndex: number) {
  return `${year}/${monthIndex + 1}`;
}

function formatMonthDay(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map((v) => Number(v));
  if (!y || !m || !d) return isoDate;
  return `${m}月${d}日`;
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

function generateMonthMockRecords(year: number, monthIndex: number): RecordItem[] {
  const seed = year * 100 + monthIndex + 1;
  const rand = seededRandom(seed);
  const dim = daysInMonth(year, monthIndex);

  const classTemplates = [
    { title: "Jazz", duration: "60分钟", subtitle: "Type N", teacher: "小路老师", stars: 2, note: "这节课主攻细节控制，后半段节奏终于跟上。", photos: [IMG_JAZZ_A, IMG_JAZZ_B] as [string, string] },
    { title: "Hiphop", duration: "45分钟", subtitle: "基础律动", teacher: "Mika老师", stars: 3, note: "今天把重心转换练顺了，动作看起来更稳。", photos: [IMG_JAZZ_B, IMG_JAZZ_A] as [string, string] },
    { title: "Chore", duration: "75分钟", subtitle: "编舞课", teacher: "Amy老师", stars: 4, note: "新段落记忆效率提升，镜面方向也更清晰。", photos: [IMG_JAZZ_A, IMG_WUTANG_A] as [string, string] },
  ];
  const elementTemplates = [
    { title: "Wutang", duration: "打卡12次", subtitle: "", stars: 4, note: "今天发力点终于找到，甩手动作不再散。", photos: [IMG_WUTANG_A, IMG_WUTANG_B] as [string, string] },
    { title: "Wave", duration: "打卡8次", subtitle: "", stars: 3, note: "波浪连接顺了很多，速度提上来后还要再稳。", photos: [IMG_WUTANG_B, IMG_WUTANG_A] as [string, string] },
    { title: "Smurf", duration: "打卡6次", subtitle: "", stars: 2, note: "肩部控制还在适应中，但节奏感更稳定。", photos: [IMG_WUTANG_A, IMG_JAZZ_B] as [string, string] },
  ];

  const records: RecordItem[] = [];
  const activeDaysCount = Math.min(dim, 8 + Math.floor(rand() * 5)); // 8~12 days
  const days = Array.from({ length: dim }, (_, i) => i + 1).sort(() => rand() - 0.5).slice(0, activeDaysCount);

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    // Keep 1~4 records/day to test dense cards and spacing.
    const perDayCount = 1 + Math.floor(rand() * 4);

    for (let j = 0; j < perDayCount; j++) {
      const isClass = rand() > 0.42;
      const dateKey = ymd(new Date(year, monthIndex, day));

      if (isClass) {
        const t = classTemplates[Math.floor(rand() * classTemplates.length)];
        const rich = rand() > 0.35; // mix rich/sparse card content
        const keepSubtitle = rich || rand() > 0.5;
        const keepTeacher = rich || rand() > 0.55;
        const keepStars = rich || rand() > 0.45;
        const keepNote = rand() > 0.25;
        const keepPhotos = rand() > 0.2;
        const onePhoto = rand() > 0.6;

        records.push({
          id: `${year}-${monthIndex + 1}-${day}-c-${i}-${j}`,
          date: dateKey,
          title: t.title,
          durationLabel: rand() > 0.12 ? t.duration : undefined,
          subtitle: keepSubtitle && t.subtitle ? t.subtitle : undefined,
          teacher: keepTeacher ? t.teacher : undefined,
          stars: keepStars ? t.stars : undefined,
          badge: "课堂记录",
          note: keepNote ? t.note : undefined,
          photos: keepPhotos ? (onePhoto ? [t.photos[0]] as [string] : t.photos) : undefined,
        });
      } else {
        const t = elementTemplates[Math.floor(rand() * elementTemplates.length)];
        const rich = rand() > 0.4;
        const keepStars = rich || rand() > 0.5;
        const keepNote = rand() > 0.3;
        const keepPhotos = rand() > 0.2;
        const onePhoto = rand() > 0.6;

        records.push({
          id: `${year}-${monthIndex + 1}-${day}-e-${i}-${j}`,
          date: dateKey,
          title: t.title,
          durationLabel: rand() > 0.18 ? t.duration : undefined,
          subtitle: undefined,
          stars: keepStars ? t.stars : undefined,
          badge: "元素记录",
          note: keepNote ? t.note : undefined,
          photos: keepPhotos ? (onePhoto ? [t.photos[0]] as [string] : t.photos) : undefined,
        });
      }
    }
  }

  return records.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? 1 : -1));
}

function IconCalendar(props: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden ${props.className ?? "h-6 w-6"}`}>
      <span className="absolute inset-[9.38%_12.5%_12.5%_12.5%]">
        <img
          src={IMG_CALENDAR_VECTOR}
          alt=""
          className="absolute inset-0 block size-full object-contain object-center"
        />
      </span>
    </span>
  );
}

function IconList(props: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden ${props.className ?? "h-6 w-6"}`}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 block size-full">
        <rect x="4" y="5" width="16" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="4" y="14" width="16" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  );
}

function StatusBarMock() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-white">
      <div className="mx-auto flex h-[44px] w-full max-w-[375px] items-center justify-between px-[21px]">
        <span
          className="text-[15px] font-medium leading-[20px] text-black"
          style={{ fontFamily: "'SF Pro Text','Helvetica Neue',Arial,sans-serif" }}
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

function OverviewHeader(props: { onOpenSummary: () => void }) {
  return (
    <div className="relative h-14">
      <img src={IMG_HEADER_ART} alt="头部插图" className="absolute left-0 top-1/2 block w-[115px] -translate-y-1/2 object-contain" />
      <button
        type="button"
        onClick={props.onOpenSummary}
        className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-end p-0 text-[13px] font-medium leading-none text-black"
        style={{ fontFamily: FONT_SF_ROUNDED }}
      >
        本月打卡18次 &gt;
      </button>
    </div>
  );
}

function BadgeIcon({ badge }: { badge: NonNullable<RecordItem["badge"]> }) {
  if (badge === "课堂记录") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <path
          d="M8 0L8.94427 5.09383L12.7023 1.52786L10.4721 6.20389L15.6085 5.52786L11.0557 8L15.6085 10.4721L10.4721 9.79611L12.7023 14.4721L8.94427 10.9062L8 16L7.05573 10.9062L3.29772 14.4721L5.52786 9.79611L0.391548 10.4721L4.94427 8L0.391548 5.52786L5.52786 6.20389L3.29772 1.52786L7.05573 5.09383L8 0Z"
          fill="#B0C16D"
        />
      </svg>
    );
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <path
        d="M7.06215 2.5345C7.38431 1.66389 8.61569 1.66389 8.93785 2.53451L10.0012 5.40803C10.1024 5.68175 10.3182 5.89756 10.592 5.99885L13.4655 7.06215C14.3361 7.38431 14.3361 8.61569 13.4655 8.93785L10.592 10.0012C10.3182 10.1024 10.1024 10.3182 10.0012 10.592L8.93785 13.4655C8.61569 14.3361 7.38431 14.3361 7.06215 13.4655L5.99885 10.592C5.89756 10.3182 5.68175 10.1024 5.40803 10.0012L2.5345 8.93785C1.66389 8.61569 1.66389 7.38431 2.53451 7.06215L5.40803 5.99885C5.68175 5.89756 5.89756 5.68175 5.99885 5.40803L7.06215 2.5345Z"
        fill="#BB9D5A"
      />
    </svg>
  );
}

function RecordCard({ item, disableMediaIntro }: { item: RecordItem; disableMediaIntro?: boolean }) {
  const bgColor = item.badge === "课堂记录" ? "#F7F8F4" : "#F8F8F8";
  const hasMedia = Boolean(item.photos && item.photos.length > 0);
  const metaParts = [item.durationLabel, item.subtitle, item.teacher].filter(
    (v): v is string => Boolean(v && v.trim().length > 0),
  );
  return (
    <article
      className="rounded-[12px] px-5 pb-3 pt-[20px] shadow-[0_1px_0_rgba(0,0,0,0.02)]"
      style={{ backgroundColor: bgColor }}
    >
      {item.badge ? (
        <div
          className="mb-[8px] flex items-center gap-1 text-[12px] font-medium leading-[16px] text-[#7c7c7c]"
          style={{ fontFamily: FONT_CN }}
        >
          <BadgeIcon badge={item.badge} />
          <span>{item.badge}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3">
        <div className={hasMedia ? "min-w-0 pr-1" : "min-w-0"}>
          <div className="flex items-center gap-1">
            <h3
              className="max-w-full truncate text-[24px] font-medium leading-[32px] tracking-[-0.1px]"
              style={{ fontFamily: FONT_SF_ROUNDED }}
            >
              {item.title}
            </h3>
            <span className={TITLE_ROW_CHEVRON_CLASS} aria-hidden>
              ›
            </span>
          </div>
          {metaParts.length > 0 ? (
            <div
              className="mt-[4px] text-[14px] font-medium leading-[20px] text-zinc-900"
              style={{ fontFamily: FONT_CN }}
            >
              {metaParts.join(" · ")}
            </div>
          ) : null}
          {item.stars && item.stars > 0 ? (
            <div className="mt-[4px] text-[11px] leading-[11px]" style={{ fontFamily: FONT_CN }}>
              {Array.from({ length: item.stars }).map((_, i) => (
                <span key={i}>★</span>
              ))}
            </div>
          ) : null}
        </div>

        {hasMedia ? (
          <MediaPreviewStack photos={item.photos ?? []} motionKey={item.id} disableIntro={disableMediaIntro} />
        ) : null}
      </div>

      {item.note && item.note.trim().length > 0 ? (
        <div
          className="mt-[10px] pb-[12px] flex items-stretch gap-3 text-[13px] font-normal leading-[19.24px] text-[#7b7b7b]"
          style={{ fontFamily: FONT_CN }}
        >
          <div className="my-[1px] w-[3px] self-stretch rounded-full bg-zinc-900" />
          <p className="min-w-0 flex-1 line-clamp-4">{item.note}</p>
        </div>
      ) : null}
    </article>
  );
}

function MediaPreviewStack({ photos, motionKey, disableIntro }: { photos: string[]; motionKey: string; disableIntro?: boolean }) {
  const list = photos.slice(0, 3);
  const count = list.length;

  if (count === 0) return null;

  const common =
    "absolute h-[120px] w-[90px] rounded-[8px] border-2 border-white object-cover shadow-sm";

  const positions =
    count === 1
      ? [{ right: 8, top: 6, z: 1, deg: 6 }]
      : count === 2
      ? [
          { right: 46, top: 8, z: 1, deg: 0 },
          { right: 4, top: 4, z: 2, deg: 6 },
        ]
      : [
          { right: 50, top: 10, z: 1, deg: 0 },
          { right: 26, top: 8, z: 2, deg: 0 },
          { right: 2, top: 4, z: 3, deg: 6 },
        ];

  function introForIndex(i: number, deg: number) {
    if (count === 1) {
      // 单图也有轻微位移入场，保持和多图一致的丝滑感
      return { x: 8, y: -2, rotate: deg + 0.8, scale: 1.008 };
    }
    if (i === 0) {
      return { x: 2, y: -1, rotate: deg + 0.3, scale: 1.003 };
    }
    return {
      x: 12 + (count - 1 - i) * 4,
      y: -2 - (count - 1 - i) * 0.35,
      rotate: deg + 1,
      scale: 1.008,
    };
  }

  return (
    <div className="relative h-[132px] w-[138px]">
      {list.map((src, i) => {
        const p = positions[i];
        const intro = introForIndex(i, p.deg);
        if (disableIntro) {
          return (
            <img
              key={`${motionKey}-${src}-${i}`}
              src={src}
              alt=""
              className={`${common} will-change-transform`}
              style={{
                right: `${p.right}px`,
                top: `${p.top}px`,
                zIndex: p.z,
                transform: `rotate(${p.deg}deg)`,
              }}
            />
          );
        }

        return (
          <motion.img
            key={`${motionKey}-${src}-${i}`}
            src={src}
            alt=""
            className={`${common} will-change-transform`}
            initial={intro}
            animate={{ x: 0, y: 0, rotate: p.deg, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 90,
              damping: 30,
              mass: 1,
              // 晚于卡片出现（但与卡片动画有交叉）
              delay: 0.14 + i * 0.06,
            }}
            style={{
              right: `${p.right}px`,
              top: `${p.top}px`,
              zIndex: p.z,
            }}
          />
        );
      })}
    </div>
  );
}

function FloatingAddButton(props: { onClick: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="relative mx-auto w-full max-w-[375px]">
        <button
          type="button"
          aria-label="新增记录"
          onClick={props.onClick}
          className="pointer-events-auto absolute bottom-[48px] right-[14px] active:scale-[0.98]"
        >
          <img src="/add-button.svg" alt="" className="block h-12 w-12" />
        </button>
      </div>
    </div>
  );
}

export default function HomeCalendarPage() {
  const router = useRouter();
  const pendingDraft = readPendingElementRecordFromSession();
  const [pageExit, setPageExit] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [addFlow, setAddFlow] = useState<null | "picker">(null);
  const now = new Date();
  const initDate = pendingDraft?.date ?? ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const initDateObj = new Date(initDate);
  const initYear = Number.isNaN(initDateObj.getTime()) ? now.getFullYear() : initDateObj.getFullYear();
  const initMonthIndex = Number.isNaN(initDateObj.getTime()) ? now.getMonth() : initDateObj.getMonth();
  const [monthCursor, setMonthCursor] = useState({
    year: initYear,
    monthIndex: initMonthIndex,
  });
  const [selectedDate, setSelectedDate] = useState(initDate);
  const [manualRecords] = useState<RecordItem[]>(pendingDraft ? [pendingDraft] : []);
  const [pendingScrollRecordId, setPendingScrollRecordId] = useState<string | null>(pendingDraft?.id ?? null);
  const recordRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const records = useMemo(() => {
    const generated = generateMonthMockRecords(monthCursor.year, monthCursor.monthIndex);
    return [...manualRecords, ...generated].sort((a, b) =>
      a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? 1 : -1,
    );
  }, [manualRecords, monthCursor.year, monthCursor.monthIndex]);

  const dateWithRecords = useMemo(() => new Set(records.map((r) => r.date)), [records]);
  const calendarPreviewByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records) {
      const firstPhoto = record.photos?.[0];
      if (firstPhoto && !map.has(record.date)) {
        map.set(record.date, firstPhoto);
      }
    }
    return map;
  }, [records]);
  const monthStart = startOfMonth(monthCursor.year, monthCursor.monthIndex);
  const offset = mondayFirstIndex(monthStart);
  const dim = daysInMonth(monthCursor.year, monthCursor.monthIndex);
  const cells = useMemo(() => {
    const total = Math.ceil((offset + dim) / 7) * 7;
    return Array.from({ length: total }).map((_, idx) => {
      const day = idx - offset + 1;
      if (day < 1 || day > dim) return null;
      const date = new Date(monthCursor.year, monthCursor.monthIndex, day);
      return { day, key: ymd(date) };
    });
  }, [dim, monthCursor.monthIndex, monthCursor.year, offset]);

  const selectedRecords = records.filter((r) => r.date === selectedDate);
  const isEmptyState = view === "calendar" && selectedRecords.length === 0;
  const listGroups = useMemo(() => {
    const groupsByDate = new Map<string, RecordItem[]>();
    const dateOrder: string[] = [];
    for (const item of records) {
      if (!groupsByDate.has(item.date)) {
        groupsByDate.set(item.date, []);
        dateOrder.push(item.date);
      }
      groupsByDate.get(item.date)!.push(item);
    }
    return dateOrder.map((date) => ({ date, items: groupsByDate.get(date)! }));
  }, [records]);

  function openAddPicker() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "forward");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/add"), 220);
  }

  function changeMonth(delta: number) {
    setMonthCursor((prev) => {
      const date = new Date(prev.year, prev.monthIndex + delta, 1);
      const nextYear = date.getFullYear();
      const nextMonthIndex = date.getMonth();
      setSelectedDate(ymd(new Date(nextYear, nextMonthIndex, 1)));
      return { year: nextYear, monthIndex: nextMonthIndex };
    });
  }

  function openDanceSummary() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "forward");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/dance-summary"), 220);
  }

  const navDirection = typeof window !== "undefined" ? window.sessionStorage.getItem("page-nav-direction") : null;
  const suppressCrossPageEntryMotion = navDirection === "back";
  const initialX = navDirection === "back" ? -22 : 22;
  if (typeof window !== "undefined" && !pageExit) {
    window.sessionStorage.removeItem("page-nav-direction");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(CHECKIN_DRAFT_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!pendingScrollRecordId) return;
    const el = recordRefs.current[pendingScrollRecordId];
    if (!el) return;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollRecordId(null);
    }, 120);
  }, [pendingScrollRecordId, selectedDate, records.length]);

  return (
    <motion.main
      className="min-h-screen bg-white text-zinc-900"
      style={{ fontFamily: UI_FONT_STACK }}
      initial={{ x: initialX, opacity: 0.01 }}
      animate={pageExit ? { x: -22, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <StatusBarMock />
      <div className="mx-auto w-full max-w-[375px] pb-24">
        <div className="px-5 pb-5 pt-[calc(44px+max(env(safe-area-inset-top),8px))]">
          <div className="sticky z-40 mb-3 bg-white pb-3 pt-1 top-[calc(44px+max(env(safe-area-inset-top),8px))]">
            <OverviewHeader onOpenSummary={openDanceSummary} />
          </div>

          <header className="flex h-[40px] items-center justify-between">
            <div className="flex h-[36px] items-center justify-center gap-2 rounded-[100px] bg-[#F0F0F0] px-3">
              <button
                type="button"
                className="flex h-full w-5 shrink-0 items-center justify-center text-zinc-500"
                onClick={() => changeMonth(-1)}
              >
                <span className={MONTH_NAV_CHEVRON_CLASS} aria-hidden>
                  ‹
                </span>
              </button>
              <div
                className="flex items-center text-[18px] font-medium leading-none"
                style={{ fontFamily: FONT_SF_COMPACT }}
              >
                {monthLabel(monthCursor.year, monthCursor.monthIndex)}
              </div>
              <button
                type="button"
                className="flex h-full w-5 shrink-0 items-center justify-center text-zinc-500"
                onClick={() => changeMonth(1)}
              >
                <span className={MONTH_NAV_CHEVRON_CLASS} aria-hidden>
                  ›
                </span>
              </button>
            </div>

            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={view === "calendar" ? "text-zinc-800" : "text-zinc-400"}
              >
                <IconCalendar className={`h-6 w-6 ${view === "calendar" ? "opacity-100" : "opacity-45"}`} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={view === "list" ? "text-zinc-800" : "text-zinc-400"}
              >
                <IconList className="h-6 w-6" />
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
          {view === "calendar" ? (
            <motion.div
              key={`calendar-${monthCursor.year}-${monthCursor.monthIndex}`}
              initial={FADE_SOFT.initial}
              animate={FADE_SOFT.animate}
              exit={FADE_SOFT.exit}
              transition={FADE_SOFT.transition}
            >
              <section className="mt-[12px]">
                <div className="grid grid-cols-7 gap-[7px]">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="h-[17px] text-center text-[12px] font-normal leading-[17px]"
                      style={{ fontFamily: FONT_CN }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-[14px] grid grid-cols-7 gap-[7px]">
                  {cells.map((cell, idx) => {
                    if (!cell) return <div key={idx} className="h-[56px] w-[42px] opacity-0" />;
                    const has = dateWithRecords.has(cell.key);
                    const selected = selectedDate === cell.key;
                    return (
                      <button key={cell.key} type="button" onClick={() => setSelectedDate(cell.key)} className="relative h-[56px] w-[42px] rounded-[6px] text-left" style={{ backgroundColor: has ? PRIMARY_GREEN : "rgba(0,0,0,0.06)" }}>
                        <span
                          className="absolute left-[6px] top-[4px] text-[12px] font-medium leading-[16px] text-[rgba(0,0,0,0.6)]"
                          style={{ fontFamily: FONT_CN }}
                        >
                          {cell.day}
                        </span>
                        {selected ? <span className="pointer-events-none absolute inset-0 rounded-[6px] border-2 border-black" /> : null}
                        {has ? (
                          <img
                            src={calendarPreviewByDate.get(cell.key) ?? IMG_JAZZ_B}
                            alt=""
                            className="absolute left-[12px] top-[20px] h-[32px] w-[24px] rotate-[6deg] rounded-[3px] border border-white object-cover"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <AnimatePresence mode="wait" initial={false}>
              {isEmptyState ? (
                <motion.section
                  key={`empty-${selectedDate}`}
                  className="mt-[24px] flex flex-col items-center gap-4 px-0 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <div className="flex w-full flex-col items-center gap-3">
                    <img
                      src={IMG_EMPTY_STATE}
                      alt="空态插图"
                      className="block h-[138px] w-full object-contain"
                    />
                    <p
                      className="w-full text-center text-[14px] font-normal leading-none text-black"
                      style={{ fontFamily: FONT_CN }}
                    >
                      今天还没有练习记录
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddPicker}
                    className="inline-flex h-[36px] w-[120px] items-center justify-center rounded-[100px] bg-black text-[14px] font-medium leading-none text-white active:scale-[0.98]"
                    style={{ fontFamily: FONT_CN }}
                  >
                    去跳舞
                  </button>
                </motion.section>
              ) : (
                <motion.section
                  key={`records-${selectedDate}`}
                  className="mt-[18px] grid gap-4"
                  initial={FADE_SOFT.initial}
                  animate={FADE_SOFT.animate}
                  exit={FADE_SOFT.exit}
                  transition={FADE_SOFT.transition}
                >
                  {selectedRecords.map((item, idx) =>
                    suppressCrossPageEntryMotion ? (
                      <div
                        key={item.id}
                        ref={(el) => {
                          recordRefs.current[item.id] = el;
                        }}
                      >
                        <RecordCard item={item} disableMediaIntro={suppressCrossPageEntryMotion} />
                      </div>
                    ) : (
                      <motion.div
                        key={item.id}
                        ref={(el) => {
                          recordRefs.current[item.id] = el;
                        }}
                        initial={{ y: 8, opacity: 0.01 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ ...SPRING_STANDARD, delay: idx * 0.05 }}
                      >
                        <RecordCard item={item} disableMediaIntro={suppressCrossPageEntryMotion} />
                      </motion.div>
                    ),
                  )}
                </motion.section>
              )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.section
              key={`list-${monthCursor.year}-${monthCursor.monthIndex}`}
              className="mt-6 flex flex-col gap-6"
              initial={FADE_SOFT.initial}
              animate={FADE_SOFT.animate}
              exit={FADE_SOFT.exit}
              transition={FADE_SOFT.transition}
            >
              {listGroups.map((group) => (
                <div key={group.date} className="flex flex-col gap-4">
                  <div className="flex h-5 items-center">
                    <span
                      className="text-[14px] font-medium leading-5 text-[rgba(0,0,0,0.6)]"
                      style={{ fontFamily: FONT_CN }}
                    >
                      {formatMonthDay(group.date)}
                    </span>
                  </div>
                  <div className="grid gap-4">
                    {group.items.map((item, idx) =>
                      suppressCrossPageEntryMotion ? (
                        <div key={item.id}>
                          <RecordCard item={item} disableMediaIntro={suppressCrossPageEntryMotion} />
                        </div>
                      ) : (
                        <motion.div
                          key={item.id}
                          initial={{ y: 8, opacity: 0.01 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ ...SPRING_STANDARD, delay: idx * 0.04 }}
                        >
                          <RecordCard item={item} disableMediaIntro={suppressCrossPageEntryMotion} />
                        </motion.div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </motion.section>
          )}
          </AnimatePresence>

        </div>
      </div>
      <FloatingAddButton onClick={openAddPicker} />
      <AnimatePresence>
        {addFlow === "picker" ? (
          <motion.div
            className="fixed inset-0 z-30 bg-black/25"
            onClick={() => setAddFlow(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <motion.div
              className="absolute bottom-0 left-1/2 w-full max-w-[375px] -translate-x-1/2 rounded-t-[20px] bg-white px-5 pb-[28px] pt-[16px]"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 24, opacity: 0.01 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={SPRING_STANDARD}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-200" />
              <div className="grid gap-2">
                <button type="button" className="h-12 rounded-[12px] bg-[#f4f5f1] text-[16px] text-zinc-900" style={{ fontFamily: FONT_CN }}>
                  课堂记录
                </button>
                <button type="button" className="h-12 rounded-[12px] bg-[#f6f6f6] text-[16px] text-zinc-900" style={{ fontFamily: FONT_CN }}>
                  元素记录
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}

