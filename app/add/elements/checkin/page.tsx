"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const FONT_CN = "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const FONT_SF_ROUNDED = "'SF Compact Rounded','SF Pro Rounded','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const SAFE_TOP = "calc(44px + max(env(safe-area-inset-top), 8px))";
const CHECKIN_DOCK_HEIGHT = 142;
const CHECKIN_DOCK_BOTTOM_OFFSET = 44;
const CHECKIN_CONTENT_SAFE_GAP = 28;

const BG_RING =
  "https://api.builder.io/api/v1/image/assets/TEMP/fadff744955ea24913e2af916d774b62b5ee7b4a?width=726";
const BG_SWOOSH =
  "https://api.builder.io/api/v1/image/assets/TEMP/985a737701b99e4fae8eeffeb3998f178c11d4fa?width=758";
const BG_DANCER =
  "https://api.builder.io/api/v1/image/assets/TEMP/ed8f408be17c40f167de8e59cdac3ad3b3a4fe2e?width=356";
const STAR_ICON =
  "https://api.builder.io/api/v1/image/assets/TEMP/f9bac69ef532fac22b6505df251a39d005028e8b?width=39";
const CAMERA_ICON =
  "https://api.builder.io/api/v1/image/assets/TEMP/edeec47836bd7bab74602c8c5e8299c7867886b1?width=48";
const CHECKIN_DRAFT_STORAGE_KEY = "home:new-element-record";

function StatusBarMock() {
  const IMG_STATUS_BATTERY =
    "https://www.figma.com/api/mcp/asset/53c5dfa3-d33b-43dc-b44c-b2f9d3d49b96";
  const IMG_STATUS_WIFI =
    "https://www.figma.com/api/mcp/asset/649858e2-3758-46e1-b35f-14ddc7183c24";
  const IMG_STATUS_SIGNAL =
    "https://www.figma.com/api/mcp/asset/9544f075-169d-4180-ad39-0e3ff3dd7e6b";

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-transparent">
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

function SectionTitle(props: { title: string }) {
  return (
    <div className="inline-flex items-center gap-[3px] rounded-[100px] bg-[#EEE] px-3 py-1">
      <img src={STAR_ICON} alt="" className="h-[20px] w-[19px] object-contain" />
      <span className="text-[14px] font-medium text-black" style={{ fontFamily: FONT_SF_ROUNDED }}>
        {props.title}
      </span>
    </div>
  );
}

export default function ElementsCheckinPage() {
  const router = useRouter();
  const [pageExit, setPageExit] = useState(false);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function submitCheckin() {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const payload = {
      id: `${date}-0-manual-superman-${Date.now()}`,
      date,
      title: "Superman",
      durationLabel: "打卡1次",
      badge: "元素记录" as const,
      note:
        note.trim() ||
        "今天练了 Superman，重心切换更顺，手臂发力和身体前冲的配合比之前稳定。继续练节奏点和动作连贯性。",
    };
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(CHECKIN_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      window.sessionStorage.setItem("page-nav-direction", "back");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/"), 220);
  }

  return (
    <motion.main
      className="min-h-screen overflow-x-hidden bg-white text-black"
      style={{ fontFamily: FONT_CN }}
      initial={{ x: initialX, opacity: 0.01 }}
      animate={pageExit ? { x: 22, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <StatusBarMock />
      <div className="fixed inset-x-0 z-50 bg-transparent" style={{ top: SAFE_TOP }}>
        <div className="mx-auto flex h-10 w-full max-w-[375px] items-center px-5">
          <button type="button" aria-label="返回上一页" onClick={goBack} className="grid h-6 w-6 place-items-center">
            <BackArrowIcon />
          </button>
          <div className="flex-1" />
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-[375px]"
        style={{
          paddingBottom: `calc(${CHECKIN_DOCK_HEIGHT + CHECKIN_DOCK_BOTTOM_OFFSET + CHECKIN_CONTENT_SAFE_GAP}px + env(safe-area-inset-bottom))`,
        }}
      >
        {/* 分层背景图 */}
        <div className="relative -mt-1 z-[0] h-[330px] w-full overflow-visible">
          <div
            className="absolute z-[1] h-[733px] w-[733px] rounded-full"
            style={{
              left: -191,
              top: -405,
              background:
                "radial-gradient(38.48% 38.48% at 50% 61.52%, rgba(255,255,255,0.20) 52.4%, rgba(176,193,109,0.20) 100%)",
              filter: "blur(2px)",
            }}
          />

          <motion.img
            src={BG_RING}
            alt=""
            className="absolute left-[19px] top-[27px] z-[2] h-[366px] w-[363px] object-contain"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut", delay: 0.05 }}
          />
          <motion.img
            src={BG_SWOOSH}
            alt=""
            className="absolute left-[-4px] top-[83px] z-[3] h-[213px] w-[379px] object-contain"
            initial={{ opacity: 0, scale: 0.8, y: 8, rotate: -6 }}
            animate={{ opacity: 1, scale: [0.8, 1.03, 1], y: 0, rotate: [-6, 2.8, -1.2, 0.4, 0] }}
            transition={{
              opacity: { duration: 0.24, ease: "easeOut", delay: 0.2 },
              scale: { duration: 0.88, ease: "easeOut", delay: 0.2 },
              y: { duration: 0.52, ease: "easeOut", delay: 0.2 },
              rotate: { duration: 1.02, ease: "easeOut", delay: 0.2 },
            }}
          />
          <motion.img
            src={BG_DANCER}
            alt=""
            className="absolute left-[106px] top-[70px] z-[4] h-[236px] w-[178px] object-contain"
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: [0.8, 1.025, 1], y: 0 }}
            transition={{
              opacity: { duration: 0.26, ease: "easeOut", delay: 0.32 },
              scale: { duration: 1.12, ease: "easeOut", delay: 0.32 },
              y: { duration: 0.62, ease: "easeOut", delay: 0.32 },
            }}
          />
          {/* Rectangle 86: 纯白渐变遮罩，位于背景图层上方、正文下方 */}
          <div
            className="pointer-events-none absolute left-0 top-[205px] z-[5] h-[197px] w-full"
            style={{
              background: "linear-gradient(180deg, rgba(254, 254, 254, 0.00) 0.31%, #FEFEFE 50.22%)",
            }}
          />
        </div>

        {/* 中间信息区（始终位于背景图层之上） */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut", delay: 0.18 }}
          className="relative z-[30] mt-[-30px] flex flex-col items-center gap-8"
        >
          <div className="flex w-full flex-col items-center gap-1">
            <div className="px-5 text-center text-[32px] font-medium leading-none text-black">Superman</div>
            <div className="flex items-center gap-1 pt-[2px] text-black/65">
              <div className="flex items-center gap-[4px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                    <path
                      d="M3.99989 0.166656L5.40856 2.22766L7.80389 2.93066L6.27889 4.90732L6.35089 7.40266L3.99989 6.56332L1.64856 7.40266L1.72056 4.90732L0.195557 2.93066L2.59122 2.22766L3.99989 0.166656Z"
                      fill="black"
                      fillOpacity={i < 2 ? 1 : 0.2}
                    />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          <div className="flex w-[312px] flex-col items-center gap-8">
            <div className="flex w-full flex-col items-center gap-2">
              <SectionTitle title="起源" />
              <p
                className="w-full text-center text-[12px] font-normal leading-[22px] text-black/70"
                style={{ fontFamily: FONT_SF_ROUNDED }}
              >
                起源于美国纽约 Harlem 的 Litefeet 舞风，是 2000 年代之后在街头舞者中流行的一个标志性动作。
                该动作以模仿“超人展翅飞行”的姿势命名，充满视觉冲击力。
              </p>
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <SectionTitle title="动作要点" />
              <p
                className="w-full text-center text-[12px] font-normal leading-[22px] text-black/70"
                style={{ fontFamily: FONT_SF_ROUNDED }}
              >
                - 上半身主导，双臂快速前伸、展开，如“超人飞行”
                <br />- 同时伴随上身挺胸、点头或身体前冲的动势
                <br />- 下身可以加入踩点或原地跳步，体现节奏感
              </p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* 顶层打卡模块（固定在最上层） */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut", delay: 0.24 }}
        className="fixed inset-x-0 z-[60] bg-transparent"
        style={{ bottom: "calc(44px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-[375px]">
          <div
            className="mx-auto flex h-[142px] w-[303px] flex-col rounded-2xl border border-black/10 bg-white pt-4 pb-6 shadow-[0_4px_16px_0_rgba(0,0,0,0.08)]"
            style={{ borderWidth: "0.5px" }}
          >
            <div className="px-5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="练习心得记录下，此时dance的心得"
                className="h-[42px] w-full resize-none border-0 bg-transparent text-[12px] leading-[18px] text-black/80 placeholder:text-black/50 focus:outline-none"
                style={{ fontFamily: FONT_SF_ROUNDED }}
              />
            </div>

            <div className="mt-auto flex items-center gap-3 px-5">
              <button
                type="button"
                className="h-12 w-[203px] rounded-[12px] bg-[#0A0A0A] text-center text-[18px] font-medium leading-none text-white"
                style={{ fontFamily: FONT_CN }}
                onClick={submitCheckin}
              >
                打卡
              </button>
              <button
                type="button"
                aria-label="上传图片"
                onClick={openImagePicker}
                className="grid h-12 w-12 place-items-center"
              >
                <img src={CAMERA_ICON} alt="" className="h-6 w-6 object-contain" />
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
        </div>
      </motion.section>
    </motion.main>
  );
}

