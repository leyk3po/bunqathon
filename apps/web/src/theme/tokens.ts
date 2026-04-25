export const BUNQ_GREEN = "#00D54B";
export const BUNQ_DARK  = "#0F1923";
export const CREAM      = "#f6f2e9";

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  live:           { bg: BUNQ_GREEN, color: "black" },
  partially_sold: { bg: BUNQ_GREEN, color: "black" },
  sold:           { bg: "#f87171", color: "white" },
  sold_out:       { bg: "#f87171", color: "white" },
  draft:          { bg: "#e5e7eb", color: "#4b5563" },
  review:         { bg: "#fef9c3", color: "#92400e" },
  paused:         { bg: "#e5e7eb", color: "#4b5563" },
  archived:       { bg: "#e5e7eb", color: "#9ca3af" },
};
