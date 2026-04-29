"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import icon24Close2x from "../icon24_close.png";
import lessonBg2x from "../课堂记录.png";
import elementBg2x from "../元素练习.png";

const FONT_CN = "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif";
const FONT_SF_ROUNDED = "'SF Compact Rounded','SF Pro Rounded','SF Pro Display','Helvetica Neue',Arial,sans-serif";

/** 与首页内容区一致：状态栏 44px + 顶部安全区 */
const SAFE_TOP = "calc(44px + max(env(safe-area-inset-top), 8px))";

const FADE_SOFT = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.24, ease: "easeOut" as const },
};

const CARD_ENTRY = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.26, ease: "easeOut" as const },
};

function StatusBarMock() {
  // 仅用于像素对齐原型：不参与业务逻辑
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

type AddType = "lesson" | "element";

function CloseIcon() {
  // 2x icon24_close：渲染为 1x，避免 SVG 在某些情况下出现裁切
  return <img src={icon24Close2x.src} alt="" aria-hidden width={36} height={36} className="block" />;
}

function StarIcon(props: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M8 0L8.94427 5.09383L12.7023 1.52786L10.4721 6.20389L15.6085 5.52786L11.0557 8L15.6085 10.4721L10.4721 9.79611L12.7023 14.4721L8.94427 10.9062L8 16L7.05573 10.9062L3.29772 14.4721L5.52786 9.79611L0.391548 10.4721L4.94427 8L0.391548 5.52786L5.52786 6.20389L3.29772 1.52786L7.05573 5.09383L8 0Z"
        fill={props.color}
      />
    </svg>
  );
}

function AddTypeCard(props: {
  selected: boolean;
  type: AddType;
  onSelect: () => void;
}) {
  const isLesson = props.type === "lesson";

  const isSelected = props.selected;
  // 整块背景图（2x），只做视觉叠层，不参与布局；选中/未选中只由底色决定
  const moduleBg = isLesson ? lessonBg2x : elementBg2x;

  return (
    <button
      type="button"
      onClick={props.onSelect}
      className="relative flex h-[128px] w-[335px] flex-col items-start rounded-[16px] p-[8px] text-left overflow-hidden"
      style={{
        boxSizing: "border-box",
        // 未选中态也保留同尺寸边框，避免卡片尺寸抖动（仅切换 borderColor）
        border: "2px solid",
        borderColor: isSelected ? "#000" : "transparent",
        transition: "border-color 260ms ease-out",
      }}
    >
      {/* 主视觉文字/底色（保证在叠层图片之上） */}
      <div
        className="relative z-[1] flex h-[108px] flex-col items-start gap-[10px] self-stretch overflow-hidden rounded-[12px] p-4"
        style={{
          background: isSelected ? "#B0C16D" : "#F5F5F5",
          transition: "background-color 260ms ease-out",
        }}
      >
        {/* 背景叠层：放到 rounded-[12px] 底板内部，避免被底板实色遮住 */}
        <img
          src={moduleBg.src}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute left-0 top-0 z-[0] select-none"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            objectPosition: "left top",
            pointerEvents: "none",
          }}
        />

        <div className="relative z-[1] flex flex-col items-start gap-[2px] self-stretch">
          <div
            className="self-stretch text-[18px] font-medium"
            style={{ fontFamily: "'PingFang SC','SF Pro Text','Helvetica Neue',Arial,sans-serif", lineHeight: "24px" }}
          >
            {isLesson ? "课堂记录" : "元素练习"}
          </div>
          <div
            className="text-[12px] font-normal"
            style={{
              fontFamily: FONT_SF_ROUNDED,
              color: "rgba(0,0,0,0.50)",
              lineHeight: "18px",
            }}
          >
            {isLesson ? "lessons Attentded" : "Hiphop Elments"}
          </div>
        </div>

      </div>
    </button>
  );
}

export default function AddPage() {
  const router = useRouter();
  const [pageExit, setPageExit] = useState(false);
  const [selected, setSelected] = useState<AddType>("lesson");

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
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("page-nav-direction", "forward");
    }
    setPageExit(true);
    window.setTimeout(() => router.push("/add/elements"), 220);
  }

  const isLesson = selected === "lesson";

  return (
    <motion.main
      className="min-h-screen bg-white text-zinc-900"
      style={{ fontFamily: FONT_CN }}
      initial={{ x: initialX, opacity: 0.01 }}
      animate={pageExit ? { x: 22, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <StatusBarMock />

      <div className="mx-auto w-full max-w-[375px] pb-10">
        <div className="relative flex flex-col items-center gap-[96px]" style={{ paddingTop: SAFE_TOP }}>
          {/* 中间内容块：关闭 + 标题/描述 + 选项卡 */}
          <div className="flex w-full flex-col items-center gap-[40px]">
            {/* 顶部关闭 */}
            <div className="flex h-[40px] w-full items-center gap-[10px] px-[20px]">
              <button
                type="button"
                aria-label="关闭"
                onClick={goBack}
                className="grid h-[36px] w-[36px] place-items-center p-0"
              >
                <CloseIcon />
              </button>
            </div>

            {/* 标题 + 描述（左对齐且左右 padding=24px） */}
          <div className="flex w-full flex-col items-start gap-[20px]">
              <div className="flex w-full items-center gap-[10px] px-[24px]">
                <div className="text-[22px] font-medium" style={{ fontFamily: FONT_CN, lineHeight: "28px" }}>
                  <span style={{ color: "rgba(0,0,0,1)" }}>
                    选择你要记录
                    <br />
                    的
                  </span>
                  <span style={{ color: "rgba(135,161,31,1)" }}>课程类型</span>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {isLesson ? (
                  <motion.div
                    key="lesson-desc"
                    initial={FADE_SOFT.initial}
                    animate={FADE_SOFT.animate}
                    exit={FADE_SOFT.exit}
                    transition={FADE_SOFT.transition}
                    className="flex min-h-[26px] w-full items-start gap-[4px] px-[24px] py-[4px]"
                  >
                    <StarIcon color="#B0C16D" />
                    <div
                      className="flex-1"
                      style={{
                        color: "rgba(0,0,0,0.50)",
                        fontFamily: FONT_SF_ROUNDED,
                        fontSize: "12px",
                        lineHeight: "18px",
                        fontWeight: 400,
                      }}
                    >
                      课堂记录可选舞种类型、上课时长、课程难度、舞蹈老师及舞室信息，支持留言及图视频上传
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="element-desc"
                    initial={FADE_SOFT.initial}
                    animate={FADE_SOFT.animate}
                    exit={FADE_SOFT.exit}
                    transition={FADE_SOFT.transition}
                    className="flex min-h-[26px] w-full items-start gap-[4px] px-[24px] py-[4px]"
                  >
                    <StarIcon color="#BB9D5A" />
                    <div
                      className="flex-1"
                      style={{
                        color: "rgba(0,0,0,0.50)",
                        fontFamily: FONT_SF_ROUNDED,
                        fontSize: "12px",
                        lineHeight: "18px",
                        fontWeight: 400,
                      }}
                    >
                      元素记录侧重Hiphop为主的基础功元素练习打卡，如Superman、Walkout、Wutang等等，也支持自定义元素
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 课程类型选项 */}
            <div className="flex w-[335px] flex-col items-start gap-[16px]">
              <motion.div
                initial={CARD_ENTRY.initial}
                animate={CARD_ENTRY.animate}
                transition={{ ...CARD_ENTRY.transition, delay: 0.08 }}
              >
                <AddTypeCard selected={selected === "lesson"} type="lesson" onSelect={() => setSelected("lesson")} />
              </motion.div>
              <motion.div
                initial={CARD_ENTRY.initial}
                animate={CARD_ENTRY.animate}
                transition={{ ...CARD_ENTRY.transition, delay: 0.14 }}
              >
                <AddTypeCard selected={selected === "element"} type="element" onSelect={() => setSelected("element")} />
              </motion.div>
            </div>
          </div>

          {/* 下一步按钮 */}
          <motion.button
            type="button"
            className="relative h-[56px] w-[319px] rounded-[46px] bg-[#0A0A0A] p-0"
            aria-label="下一步"
            onClick={goNext}
            initial={CARD_ENTRY.initial}
            animate={CARD_ENTRY.animate}
            transition={{ ...CARD_ENTRY.transition, delay: 0.2 }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "72.944px",
                color: "rgba(255,255,255,1)",
                fontFamily: FONT_CN,
                fontSize: "18px",
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              下一步
            </div>
            <svg
              className="absolute"
              width="16"
              viewBox="0 0 16 0"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
              style={{
                right: 27,
                bottom: 28,
              }}
            >
              <path
                d="M1.18091e-07 -1C-0.552285 -1 -1 -0.552285 -1 -6.4719e-08C-1 0.552285 -0.552285 1 -1.18091e-07 1L0 0L1.18091e-07 -1ZM16.7071 0.707108C17.0976 0.316584 17.0976 -0.316581 16.7071 -0.707106L10.3431 -7.07107C9.95262 -7.46159 9.31946 -7.46159 8.92893 -7.07107C8.53841 -6.68054 8.53841 -6.04738 8.92893 -5.65685L14.5858 9.43977e-07L8.92893 5.65685C8.53841 6.04738 8.53841 6.68054 8.92893 7.07107C9.31946 7.46159 9.95262 7.46159 10.3431 7.07107L16.7071 0.707108ZM0 0L-1.18091e-07 1L16 1L16 1.0355e-06L16 -0.999999L1.18091e-07 -1L0 0Z"
                fill="white"
              />
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.main>
  );
}

