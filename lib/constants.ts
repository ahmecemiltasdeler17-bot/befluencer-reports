import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "BeFluencer Reports";

export const NAV_ITEMS: {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    label: "Analytics",
    href: "#",
    icon: BarChart3,
    disabled: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const CHART_COLORS = {
  primary: "#FAFAFA",
  secondary: "#A1A1AA",
  muted: "#52525B",
  accent: "#3B82F6",
  grid: "rgba(255,255,255,0.06)",
  tooltip: "#18181B",
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FAFAFA",
  instagram: "#E1306C",
  youtube: "#FF0000",
};
