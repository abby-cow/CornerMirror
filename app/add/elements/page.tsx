"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const FONT_CN = "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const FONT_SF_ROUNDED = "'SF Compact Rounded','SF Pro Rounded','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const SAFE_TOP = "calc(44px + max(env(safe-area-inset-top), 8px))";

const GROUP_COLORS = {
  oldschool: "rgba(0, 0, 0, 0.06)",
  litefeet: "#EDEAE2",
  newschool: "#E8ECDA",
} as const;

const CHIP_ENTRY = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

const ELEMENT_ITEMS: Array<{ label: string; group: keyof typeof GROUP_COLORS }> = [
  { label: "+创建", group: "oldschool" },
  { label: "Reebok", group: "oldschool" },
  { label: "Smurf", group: "oldschool" },
  { label: "Patty Duke", group: "oldschool" },
  { label: "Steve Martin", group: "oldschool" },
  { label: "ATL Stomp", group: "oldschool" },
  { label: "Bart Simpson", group: "oldschool" },
  { label: "Roger Rabbit", group: "oldschool" },
  { label: "Cabbage Patch", group: "oldschool" },
  { label: "Wop", group: "oldschool" },
  { label: "Brooklyn Bounce", group: "oldschool" },
  { label: "Wutang", group: "litefeet" },
  { label: "Tone Wop", group: "litefeet" },
  { label: "Chicken Noodle Soup", group: "litefeet" },
  { label: "Lock In", group: "litefeet" },
  { label: "Bad One", group: "litefeet" },
  { label: "Rev-Up", group: "litefeet" },
  { label: "2-Step", group: "litefeet" },
  { label: "Superman", group: "litefeet" },
  { label: "Harlem Shake", group: "litefeet" },
  { label: "Get Lite", group: "litefeet" },
  { label: "Isolation", group: "newschool" },
  { label: "Bounce", group: "newschool" },
  { label: "Groove", group: "newschool" },
  { label: "Hitting", group: "newschool" },
  { label: "Texture", group: "newschool" },
  { label: "Bounce walk", group: "newschool" },
];

function StatusBarMock() {
  const IMG_STATUS_BATTERY =
    "https://www.figma.com/api/mcp/asset/53c5dfa3-d33b-43dc-b44c-b2f9d3d49b96";
  const IMG_STATUS_WIFI =
    "https://www.figma.com/api/mcp/asset/649858e2-3758-46e1-b35f-14ddc7183c24";
  const IMG_STATUS_SIGNAL =
    "https://www.figma.com/api/mcp/asset/9544f075-169d-4180-ad39-0e3ff3dd7e6b";

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-white">
      <div className="mx-auto flex h-[44px] w-full max-w-[375px] items-center justify-between px-[21px]">
        <span className="text-[15px] font-medium leading-[20px] text-black" style={{ fontFamily: FONT_SF_ROUNDED }}>
          21:41
        </span>
        <div className="flex items-center gap-[6px]">
          <img src={IMG_STATUS_SIGNAL} alt="" className="block h-[10px] w-[17px] object-contain object-center" />
          <img src={IMG_STATUS_WIFI} alt="" className="block h-[11px] w-[15px] object-contain object-center" />
          <img src={IMG_STATUS_BATTERY} alt="" className="block h-[11px] w-[24px] object-contain object-center" />
        </div>
      </div>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.5 5L7.5 12L14.5 19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="black" strokeWidth="2" />
      <path d="M16 16L20 20" stroke="black" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 12.5L10.2 17L18.5 8.5"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AddElementsPage() {
  const router = useRouter();
  const [pageExit, setPageExit] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const navDirection =
    typeof window !== "undefined" ? window.sessionStorage.getItem("page-nav-direction") : null;
  const initialX = navDirection === "back" ? -22 : 22;

  if (typeof window !== "undefined" && !pageExit) {
    window.sessionStorage.removeItem("page-nav-direction");
  }

  function goBack() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "back");
    }
    setPageExit(true);
    window.setTimeout(() => router.back(), 220);
  }

  function goNext() {
    if (!selected) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "forward");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/add/elements/checkin"), 220);
  }

  const chips = useMemo(() => ELEMENT_ITEMS, []);

  return (
    <motion.main
      className="min-h-screen bg-white text-black"
      style={{ fontFamily: FONT_CN }}
      initial={{ x: initialX, opacity: 0.01 }}
      animate={pageExit ? { x: 22, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <StatusBarMock />

      <div className="mx-auto w-full max-w-[375px] pb-10">
        <div className="sticky top-0 z-40 bg-white" style={{ paddingTop: SAFE_TOP }}>
          <div className="flex h-10 w-full items-center justify-between px-5">
            <button type="button" aria-label="返回" onClick={goBack} className="grid h-6 w-6 place-items-center">
              <BackArrowIcon />
            </button>
            <div className="text-[18px] font-medium leading-none">元素练习</div>
            <button
              type="button"
              aria-label={selected ? "已选择内容" : "搜索"}
              className="grid h-6 w-6 place-items-center"
              onClick={goNext}
            >
              {selected ? <CheckIcon /> : <SearchIcon />}
            </button>
          </div>
          {/* 标题区与标签区之间的安全间距 */}
          <div className="h-2 w-full" />
        </div>

        <div className="mt-3 flex w-full flex-wrap content-start gap-x-1 gap-y-2 px-5">
          {chips.map((chip, idx) => {
            const active = selected === chip.label;
            return (
              <motion.button
                key={chip.label}
                type="button"
                onClick={() => setSelected(chip.label)}
                className="rounded-[20px] px-4 py-5 text-[16px] leading-none"
                initial={CHIP_ENTRY.initial}
                animate={CHIP_ENTRY.animate}
                transition={{
                  duration: 0.22,
                  ease: "easeOut",
                  delay: 0.04 + Math.min(idx, 11) * 0.018,
                }}
                style={{
                  background: active ? "#000" : GROUP_COLORS[chip.group],
                  color: active ? "#FFF" : "#000",
                  fontWeight: active ? 600 : 500,
                  transition: "background-color 220ms ease-out, color 220ms ease-out",
                }}
              >
                {chip.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.main>
  );
}

