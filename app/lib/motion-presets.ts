"use client";

export const SPRING_STANDARD = {
  type: "spring" as const,
  stiffness: 170,
  damping: 26,
  mass: 1,
};

export const SPRING_PROMINENT = {
  type: "spring" as const,
  stiffness: 120,
  damping: 14,
  mass: 1,
};

export const SPRING_RESPONSIVE = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

export const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING_STANDARD,
  },
};
