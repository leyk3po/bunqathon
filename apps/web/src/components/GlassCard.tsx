import { useState, type ReactNode } from "react";
import { Box } from "@chakra-ui/react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  const [mouse, setMouse] = useState({ x: -300, y: -300 });

  return (
    <Box
      className={`glass-card${className ? ` ${className}` : ""}`}
      onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => setMouse({ x: -300, y: -300 })}
      {...props}
    >
      {children}
      {/* Spotlight — after children in DOM so it paints on top, pointer-events none */}
      <Box
        position="absolute"
        inset={0}
        borderRadius="inherit"
        pointerEvents="none"
        style={{
          backgroundImage: `radial-gradient(circle 220px at ${mouse.x}px ${mouse.y}px, var(--glass-spotlight), transparent)`,
        }}
      />
    </Box>
  );
}
