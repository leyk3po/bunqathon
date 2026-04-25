import { useEffect, useRef, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { api, eurosFromCents } from "../api";
import { BORDER, FONT, G, MUTED, TEXT } from "../theme/tokens";

type Turn = { role: "user" | "assistant"; text: string };

const HINTS = [
  "“€10 and we're walking out with it 😎”",
  "“can you do 12 in cash?”",
  "“my friend got it cheaper last week…”",
  "“round it down for me?”",
  "“hook me up — quick sale, low price?”",
];

function randomHint() {
  return HINTS[Math.floor(Math.random() * HINTS.length)];
}

export function HagglePanel({
  slug,
  listedPriceCents,
  onDeal,
}: {
  slug: string;
  listedPriceCents: number;
  onDeal: (cents: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<number | null>(null);
  const [dealCents, setDealCents] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [bursts, setBursts] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [hint] = useState(randomHint);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, pending]);

  function spawnBurst(emoji: string) {
    const id = Date.now() + Math.random();
    const left = 30 + Math.random() * 40;
    setBursts((b) => [...b, { id, emoji, left }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1400);
  }

  async function send() {
    const message = draft.trim();
    if (!message || pending) return;
    setError("");
    setDraft("");
    const next = [...history, { role: "user" as const, text: message }];
    setHistory(next);
    setPending(true);
    try {
      const res = await api.haggle(slug, { message, history });
      setHistory((h) => [...h, { role: "assistant" as const, text: res.reply }]);
      const prev = currentOffer;
      if (res.offer_cents != null) {
        setCurrentOffer(res.offer_cents);
        if (prev != null && res.offer_cents < prev) {
          spawnBurst("⬇️");
        } else if (prev != null && res.offer_cents > prev) {
          spawnBurst("⬆️");
        }
      }
      if (res.deal_cents != null) {
        setDealCents(res.deal_cents);
        onDeal(res.deal_cents);
        ["🎉", "🥳", "💸", "🤝", "🎊"].forEach((e, i) => {
          setTimeout(() => spawnBurst(e), i * 120);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Haggle failed");
      setHistory((h) => h.slice(0, -1));
      setDraft(message);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Box
        as="button"
        onClick={() => setOpen(true)}
        w="full"
        h="48px"
        bg="transparent"
        border="1.5px dashed"
        borderColor={TEXT}
        color={TEXT}
        fontFamily={FONT}
        fontSize="13px"
        fontWeight="700"
        letterSpacing="0.04em"
        textTransform="uppercase"
        cursor="pointer"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        gap="10px"
        transition="all 200ms ease"
        position="relative"
        _hover={{ bg: TEXT, color: "white", borderStyle: "solid", transform: "translateY(-1px)" }}
        _active={{ transform: "scale(0.98)" }}
      >
        <Box as="span" fontSize="18px" lineHeight="1">💬</Box>
        Try haggling with the AI
        <Box
          as="span"
          fontSize="9px"
          fontWeight="800"
          letterSpacing="0.18em"
          bg={G}
          color="black"
          px="6px"
          py="3px"
          borderRadius="999px"
        >
          AI
        </Box>
      </Box>
    );
  }

  return (
    <Box
      bg="rgba(255,255,255,0.6)"
      border="1px solid"
      borderColor={BORDER}
      borderRadius="18px"
      overflow="hidden"
      position="relative"
      style={{ backdropFilter: "blur(14px) saturate(160%)" }}
      boxShadow="0 8px 32px -16px rgba(0,0,0,0.18)"
    >
      {/* Floating emoji burst layer */}
      <Box position="absolute" inset="0" pointerEvents="none" overflow="hidden" zIndex={3}>
        {bursts.map((b) => (
          <Box
            key={b.id}
            position="absolute"
            bottom="80px"
            left={`${b.left}%`}
            fontSize="28px"
            style={{
              animation: "fd-haggle-burst 1.4s cubic-bezier(0.2,0.8,0.2,1) forwards",
              animationFillMode: "forwards",
            }}
          >
            {b.emoji}
          </Box>
        ))}
      </Box>

      {/* Header */}
      <Flex justify="space-between" align="center" px="14px" py="12px" borderBottom="1px solid" borderColor={BORDER}>
        <Flex align="center" gap="10px">
          <Box
            h="32px"
            w="32px"
            borderRadius="full"
            bg={G}
            color="black"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="18px"
            boxShadow={`0 0 0 4px ${G}33`}
          >
            🤖
          </Box>
          <Box>
            <Text fontFamily={FONT} fontSize="13px" fontWeight="800" letterSpacing="-0.01em" color={TEXT}>
              Seller's haggle bot
            </Text>
            <Flex align="center" gap="6px" mt="1px">
              <Box h="6px" w="6px" borderRadius="full" bg={G} style={{ animation: "fd-haggle-blink 1.4s ease-in-out infinite" }} />
              <Text fontFamily={FONT} fontSize="10px" letterSpacing="0.18em" textTransform="uppercase" color={MUTED}>
                Online · Drives a hard bargain
              </Text>
            </Flex>
          </Box>
        </Flex>
        <Box
          as="button"
          onClick={() => setOpen(false)}
          fontFamily={FONT}
          fontSize="11px"
          color={MUTED}
          bg="transparent"
          border="none"
          cursor="pointer"
          letterSpacing="0.1em"
          textTransform="uppercase"
          _hover={{ color: TEXT }}
        >
          Close
        </Box>
      </Flex>

      {/* Conversation */}
      <Box ref={scrollRef} px="14px" py="14px" maxH="240px" overflowY="auto" css={{ scrollBehavior: "smooth" }}>
        {history.length === 0 && !pending && (
          <Box>
            <Text fontFamily={FONT} fontSize="13px" color={TEXT} lineHeight="1.5" mb="6px">
              Make me an offer. <Box as="span" fontSize="14px">👀</Box>
            </Text>
            <Text fontFamily={FONT} fontSize="12px" color={MUTED} fontStyle="italic">
              Try: {hint}
            </Text>
          </Box>
        )}
        {history.map((t, i) => (
          <Flex key={i} justify={t.role === "user" ? "flex-end" : "flex-start"} mb="10px" align="flex-end" gap="8px">
            {t.role === "assistant" && (
              <Box
                h="22px"
                w="22px"
                borderRadius="full"
                bg={G}
                color="black"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="12px"
                flexShrink={0}
                mb="2px"
              >
                🤖
              </Box>
            )}
            <Box
              maxW="78%"
              bg={t.role === "user" ? TEXT : "rgba(255,255,255,0.92)"}
              color={t.role === "user" ? "white" : TEXT}
              border={t.role === "user" ? "none" : "1px solid"}
              borderColor={BORDER}
              borderRadius={t.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px"}
              px="14px"
              py="10px"
              fontFamily={FONT}
              fontSize="13px"
              lineHeight="1.45"
              whiteSpace="pre-wrap"
              boxShadow="0 2px 8px -4px rgba(0,0,0,0.08)"
              style={{ animation: "fd-haggle-pop 220ms cubic-bezier(0.2,0.8,0.2,1)" }}
            >
              {t.text}
            </Box>
          </Flex>
        ))}
        {pending && (
          <Flex justify="flex-start" mb="10px" align="flex-end" gap="8px">
            <Box h="22px" w="22px" borderRadius="full" bg={G} color="black" display="flex" alignItems="center" justifyContent="center" fontSize="12px" flexShrink={0} mb="2px">
              🤖
            </Box>
            <Box
              bg="rgba(255,255,255,0.92)"
              border="1px solid"
              borderColor={BORDER}
              borderRadius="16px 16px 16px 4px"
              px="14px"
              py="10px"
            >
              <Flex gap="4px">
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    h="7px"
                    w="7px"
                    borderRadius="full"
                    bg={MUTED}
                    style={{ animation: `fd-haggle-bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                  />
                ))}
              </Flex>
            </Box>
          </Flex>
        )}
      </Box>

      {/* Offer/deal strip */}
      {(currentOffer != null || dealCents != null) && (
        <Flex
          justify="space-between"
          align="center"
          px="14px"
          py="12px"
          bg={dealCents != null ? G : "rgba(0,0,0,0.04)"}
          color={dealCents != null ? "black" : TEXT}
          borderTop="1px solid"
          borderColor={BORDER}
          style={{ animation: "fd-haggle-pop 260ms cubic-bezier(0.2,0.8,0.2,1)" }}
        >
          <Flex align="center" gap="8px">
            {dealCents != null && <Box as="span" fontSize="18px">🤝</Box>}
            <Text fontFamily={FONT} fontSize="11px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase">
              {dealCents != null ? "Deal locked!" : "Current asking"}
            </Text>
          </Flex>
          <Text fontFamily={FONT} fontSize="22px" fontWeight="900" letterSpacing="-0.025em">
            € {eurosFromCents((dealCents ?? currentOffer)!)}
          </Text>
        </Flex>
      )}

      {/* Composer */}
      <Flex gap="8px" p="10px" borderTop="1px solid" borderColor={BORDER}>
        <Box
          as="input"
          flex="1"
          h="44px"
          px="14px"
          fontFamily={FONT}
          fontSize="14px"
          color={TEXT}
          bg="white"
          border="1px solid"
          borderColor={BORDER}
          borderRadius="22px"
          {...{ placeholder: "type your offer…", value: draft, disabled: pending } as any}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && send()}
          _focus={{ outline: "none", borderColor: TEXT }}
        />
        <Box
          as="button"
          onClick={send}
          h="44px"
          px="20px"
          bg={TEXT}
          color="white"
          border="none"
          borderRadius="22px"
          fontFamily={FONT}
          fontSize="14px"
          fontWeight="700"
          letterSpacing="0.02em"
          cursor={pending || !draft.trim() ? "not-allowed" : "pointer"}
          opacity={pending || !draft.trim() ? 0.5 : 1}
          _hover={{ opacity: 0.85, transform: "translateY(-1px)" }}
          _active={{ transform: "scale(0.96)" }}
          transition="all 150ms ease"
        >
          Send →
        </Box>
      </Flex>

      {error && (
        <Text fontFamily={FONT} fontSize="12px" color="red.500" px="14px" pb="10px">{error}</Text>
      )}

      <style>{`
        @keyframes fd-haggle-pop {
          0% { transform: scale(0.92) translateY(6px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fd-haggle-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fd-haggle-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes fd-haggle-burst {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-140px) scale(1.4) rotate(${Math.random() > 0.5 ? "20deg" : "-20deg"}); opacity: 0; }
        }
      `}</style>
    </Box>
  );
}
