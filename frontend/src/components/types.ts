import { ReactNode } from "react";

export interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export interface LabelProps {
  children: ReactNode;
}

export interface MockWindowProps {
  title: string;
  children: ReactNode;
}

export interface NotifProps {
  from: string;
  time: string;
  subject: string;
  body: ReactNode;
  link: string;
  accent?: "emerald" | "yellow";
}

export interface ScenarioCardProps {
  icon: string;
  title: string;
  desc: string;
}

export interface TimelineItem {
  dot: "green" | "yellow";
  label: string;
  text: ReactNode;
}

export interface UseSectionProps {
  tag: string;
  title: ReactNode;
  intro: ReactNode;
  scenarios: ScenarioCardProps[];
  visual: ReactNode;
  flip?: boolean;
  dark?: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
}