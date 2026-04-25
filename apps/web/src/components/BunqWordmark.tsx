export function BunqWordmark({ height = 28 }: { height?: number | string }) {
  return (
    <img
      src="/logo.png"
      alt="FlashDrop"
      className="logo-img"
      style={{ height: typeof height === "number" ? `${height}px` : height, width: "auto", display: "block", userSelect: "none" }}
      draggable={false}
    />
  );
}
