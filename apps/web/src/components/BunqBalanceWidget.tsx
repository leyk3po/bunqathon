import { useEffect, useRef, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { api } from "../api";
import { BORDER, CARD, FONT, G, MUTED, TEXT } from "../theme/tokens";

type Snap = {
  account_id: number;
  description: string;
  balance_cents: number;
  currency: string;
  iban: string | null;
};

function formatCents(cents: number, currency = "EUR") {
  const sign = currency === "EUR" ? "€" : currency;
  return `${sign} ${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function maskIban(iban: string | null) {
  if (!iban) return "";
  const tail = iban.replace(/\s+/g, "").slice(-4);
  return `IBAN •••• ${tail}`;
}

/**
 * Live bunq monetary-account balance.
 * Polls every 12s and exposes a `bump` signal — call it after a payment SSE
 * event to refetch immediately.
 */
export function BunqBalanceWidget({
  bumpKey = 0,
  variant = "card",
}: {
  bumpKey?: number;
  variant?: "card" | "wall";
}) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCents, setDisplayCents] = useState<number>(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const s = await api.getBunqBalance();
        if (!active) return;
        setSnap(s);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "bunq unreachable");
      }
    };
    tick();
    const id = window.setInterval(tick, 12000);
    return () => { active = false; window.clearInterval(id); };
  }, [bumpKey]);

  // Animated count-up to new balance
  useEffect(() => {
    if (!snap) return;
    const target = snap.balance_cents;
    const start = displayCents;
    if (target === start) return;
    const duration = 700;
    const t0 = performance.now();
    cancelAnimationFrame(animRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(start + (target - start) * eased);
      setDisplayCents(v);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.balance_cents]);

  const isWall = variant === "wall";

  return (
    <Box
      bg={CARD}
      border="1px solid"
      borderColor={BORDER}
      borderRadius={isWall ? "20px" : "16px"}
      px={isWall ? "24px" : "18px"}
      py={isWall ? "20px" : "16px"}
      boxShadow="0 12px 36px -18px rgba(0,0,0,0.18), 0 1px 0 rgba(0,0,0,0.04)"
      position="relative"
      overflow="hidden"
    >
      {/* Top-left bunq pip */}
      <Flex align="center" gap="10px" mb="10px">
        <Box
          h="10px" w="10px"
          borderRadius="full"
          bg={G}
          boxShadow={`0 0 0 5px ${G}33`}
          style={{ animation: "fd-bunq-pulse 1.6s ease-in-out infinite" }}
        />
        <Text fontFamily={FONT} fontSize="10px" fontWeight="800" letterSpacing="0.22em" textTransform="uppercase" color={G}>
          bunq · live
        </Text>
        <Text fontFamily={FONT} fontSize="10px" letterSpacing="0.2em" color={MUTED} textTransform="uppercase" ml="auto">
          {snap?.description || "Main"}
        </Text>
      </Flex>

      {/* Balance */}
      {error ? (
        <Box>
          <Text fontFamily={FONT} fontSize="12px" color={MUTED}>
            bunq sandbox not reachable
          </Text>
          <Text fontFamily={FONT} fontSize="11px" color={MUTED} mt="4px">
            {error}
          </Text>
        </Box>
      ) : (
        <>
          <Text
            fontFamily={FONT}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={TEXT}
            fontSize={isWall ? "clamp(2.5rem, 5vw, 4rem)" : "clamp(1.6rem, 3vw, 2.4rem)"}
            lineHeight="1"
            fontVariantNumeric="tabular-nums"
          >
            {formatCents(displayCents, snap?.currency)}
          </Text>
          <Text fontFamily={FONT} fontSize="11px" letterSpacing="0.16em" textTransform="uppercase" color={MUTED} mt="8px">
            {snap?.iban ? maskIban(snap.iban) : `Account #${snap?.account_id ?? "—"}`}
          </Text>
        </>
      )}

      <style>{`@keyframes fd-bunq-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.7); opacity: 0.6; } }`}</style>
    </Box>
  );
}
