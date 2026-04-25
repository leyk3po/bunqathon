import { useEffect, useRef, useState } from "react";
import { Box, Flex, QrCode, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { BG, BORDER, CARD, DARK, FONT, G, INK_FG, MUTED, TEXT } from "../theme/tokens";
import { GlassCard } from "./GlassCard";

const FEATURED = [
  { n: "01", title: "Coca-Cola Cherry Vanilla — 24 cans", place: "Booth 4 · Amsterdam", img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1400&q=80" },
  { n: "02", title: "Tame Impala — 'Currents' vinyl", place: "Pop-up · Rotterdam", img: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?auto=format&fit=crop&w=1400&q=80" },
  { n: "03", title: "Nike Air Max 90 — size 42", place: "Garage · Eindhoven", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1400&q=80" },
  { n: "04", title: "Polaroid SX-70 + 2 film packs", place: "Flea market · Den Haag", img: "https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=1400&q=80" },
  { n: "05", title: "Levi's 501 vintage — 32×32", place: "Stoop sale · Utrecht", img: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1400&q=80" },
  { n: "06", title: "Sourdough loaf — baked today", place: "Bakery · Haarlem", img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80" },
];

const STEPS = [
  { n: "01", t: "Snap", body: "Point your phone at anything sellable. One photo. Tap." },
  { n: "02", t: "Drop", body: "AI writes the title, description and a fair price. Edit if you want." },
  { n: "03", t: "Sold", body: "Buyers scan a bunq.me QR. Money lands in your account, instantly." },
];

function useLocalTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <Box
      as="button"
      onClick={toggle}
      w="36px" h="36px"
      borderRadius="50%"
      bg={CARD}
      border="1px solid"
      borderColor={BORDER}
      color={TEXT}
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      flexShrink={0}
      _hover={{ bg: BORDER }}
      transition="background 150ms ease"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Box>
  );
}

function LogoMark() {
  return (
    <Box
      as="img"
      src="/logo.png"
      alt="FlashDrop"
      display="block"
      draggable={false}
      css={{ height: "clamp(24px, 2.4vw, 36px)", width: "auto" }}
    />
  );
}

function NavSignInLink() {
  return (
    <Link to="/login">
      <Text
        fontSize="13px"
        fontWeight="600"
        letterSpacing="0.04em"
        textTransform="uppercase"
        borderBottom="1.5px solid"
        borderColor={TEXT}
        color={TEXT}
        pb="2px"
        _hover={{ opacity: 0.6 }}
      >
        Sign in
      </Text>
    </Link>
  );
}

function smoothScrollTo(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function HeroCTA() {
  return (
    <Box
      as="a"
      href="#how-it-works"
      onClick={smoothScrollTo("how-it-works")}
      bg={DARK}
      color={INK_FG}
      px="28px"
      py="18px"
      fontWeight="700"
      fontSize="14px"
      letterSpacing="0.04em"
      textTransform="uppercase"
      display="inline-flex"
      alignItems="center"
      gap="10px"
      cursor="pointer"
      _hover={{ opacity: 0.85 }}
      transition="opacity 150ms ease"
    >
      See how it works <Box as="span" fontSize="18px" lineHeight="1">↓</Box>
    </Box>
  );
}

export default function HeroPage() {
  const { dark, toggle } = useLocalTheme();
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const scrollCarousel = (dir: 1 | -1) => () => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLDivElement>("[data-card]");
    const step = card ? card.getBoundingClientRect().width + 32 : 360;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0; // sub-pixel accumulator so slow speed renders smoothly
    const SPEED = 32; // px/sec

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      acc += SPEED * dt;
      if (acc >= 1) {
        const inc = Math.floor(acc);
        acc -= inc;
        el.scrollLeft += inc;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Box color={TEXT} minH="100dvh" fontFamily={FONT} position="relative">
      <style>{`
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
        #how-it-works, #featured, #fine-print { scroll-margin-top: 96px; }
        @keyframes fd-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      {/* Mesh bg — same as login screen, fixed full-page */}
      <Box className="login-bg">
        <Box className="lorb lorb-1" />
        <Box className="lorb lorb-2" />
        <Box className="lorb lorb-3" />
        <Box className="lorb lorb-4" />
      </Box>

      {/* Top nav — liquid-glass bar */}
      <GlassCard
        as="header"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={{ base: "24px", md: "56px" }}
        h={{ base: "60px", md: "68px" }}
        borderRadius="0"
        position="sticky"
        top="0"
        zIndex={50}
        overflow="visible"
      >
        <Box position="relative" alignSelf="stretch" display="flex" alignItems="center" overflow="visible">
          <LogoMark />
        </Box>
        <Flex align="center" gap="20px">
          <ThemeToggle dark={dark} toggle={toggle} />
          <NavSignInLink />
        </Flex>
      </GlassCard>

      {/* Hero — fits above the fold */}
      <Box
        position="relative"
        zIndex={1}
        px={{ base: "24px", md: "56px" }}
        pt={{ base: "20px", md: "28px" }}
        pb={{ base: "28px", md: "32px" }}
        minH={{ md: "calc(100dvh - 76px)" }}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        gap={{ base: "20px", md: "16px" }}
      >
        <Flex justify="space-between" align="baseline" gap="16px" wrap="wrap">
          <Text
            fontSize={{ base: "11px", md: "12px" }}
            letterSpacing="0.18em"
            textTransform="uppercase"
            fontWeight="600"
            color={TEXT}
          >
            Phone camera → AI mini-shop → bunq.me QR
          </Text>
          <Text
            fontSize="11px"
            letterSpacing="0.18em"
            textTransform="uppercase"
            color={MUTED}
            fontVariantNumeric="tabular-nums"
          >
            Bunqathon · 2026 · No. 01
          </Text>
        </Flex>

        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1.5fr) minmax(0, 1fr)" }}
          gap={{ base: "28px", md: "48px" }}
          alignItems="center"
          flex="1"
        >
          {/* Left — headline + body + CTA */}
          <Flex direction="column" justify="center" gap={{ base: "20px", md: "28px" }}>
            <Text
              as="h1"
              fontWeight="900"
              lineHeight="0.86"
              letterSpacing="-0.045em"
              fontSize={{ base: "clamp(3.2rem, 16vw, 5.5rem)", md: "clamp(4rem, 8vw, 8rem)" }}
              color={TEXT}
            >
              Snap.<br />Drop.<br />Sold.
            </Text>

            <Flex
              align="flex-end"
              justify="space-between"
              gap="24px"
              wrap="wrap"
            >
              <Text maxW="500px" fontSize={{ base: "15px", md: "16px" }} lineHeight="1.5" color={TEXT} opacity={0.82}>
                Point your camera at anything sellable. We turn it into a paid drop with a bunq QR — in under thirty seconds.
              </Text>
              <HeroCTA />
            </Flex>
          </Flex>

          {/* Right — liquid-glass pay-card */}
          <GlassCard
            display={{ base: "none", md: "flex" }}
            flexDirection="column"
            position="relative"
            color={TEXT}
            borderRadius="20px"
            overflow="hidden"
            maxH={{ md: "560px" }}
            justifySelf="end"
            w="full"
            maxW="440px"
          >
            <Flex
              justify="space-between"
              align="center"
              px="16px"
              py="10px"
              borderBottom="1.5px solid"
              borderColor={TEXT}
              fontSize="10px"
              letterSpacing="0.22em"
              textTransform="uppercase"
              fontWeight="700"
              fontVariantNumeric="tabular-nums"
            >
              <Flex align="center" gap="8px">
                <Box h="6px" w="6px" borderRadius="full" bg={G} boxShadow={`0 0 0 3px ${G}33`} />
                <Text>Pay with bunq.me</Text>
              </Flex>
              <Text>€ 18,00</Text>
            </Flex>

            <Flex flex="1" align="center" justify="center" p={{ md: "18px" }} bg="transparent">
              <Box
                position="relative"
                bg="#fff"
                p="10px"
                border="1.5px solid"
                borderColor={TEXT}
                _before={{
                  content: '""', position: "absolute", top: "-6px", left: "-6px",
                  borderTop: "1.5px solid", borderLeft: "1.5px solid",
                  borderColor: TEXT,
                  width: "14px", height: "14px",
                }}
                _after={{
                  content: '""', position: "absolute", bottom: "-6px", right: "-6px",
                  borderBottom: "1.5px solid", borderRight: "1.5px solid",
                  borderColor: TEXT,
                  width: "14px", height: "14px",
                }}
              >
                <QrCode.Root
                  value="https://bunq.me/flashdrop/demo-eur18"
                  bg="white"
                  color="#000"
                >
                  <QrCode.Frame style={{ width: "260px", height: "260px" }}>
                    <QrCode.Pattern />
                  </QrCode.Frame>
                </QrCode.Root>
              </Box>
            </Flex>

            <Flex
              justify="space-between"
              align="center"
              bg={DARK}
              color={INK_FG}
              px="16px"
              py="12px"
              borderTop="1.5px solid"
              borderColor={TEXT}
            >
              <Flex align="center" gap="10px">
                <Box h="8px" w="8px" bg={G} />
                <Text fontSize="13px" fontWeight="900" letterSpacing="-0.01em">
                  bunq.me / flashdrop
                </Text>
              </Flex>
              <Text fontSize="10px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" opacity={0.7}>
                FD–2026–0001
              </Text>
            </Flex>
          </GlassCard>
        </Box>
      </Box>

      {/* Marquee strip — glass band, soft */}
      <Box position="relative" zIndex={1} px={{ base: "16px", md: "32px" }} py={{ base: "16px", md: "20px" }}>
        <GlassCard borderRadius="999px" overflow="hidden" py="12px">
          <Flex
            gap="48px"
            align="center"
            fontSize="12px"
            letterSpacing="0.22em"
            textTransform="uppercase"
            fontWeight="600"
            whiteSpace="nowrap"
            color={TEXT}
            style={{ animation: "fd-marquee 32s linear infinite" }}
          >
            {Array.from({ length: 3 }).flatMap((_, copy) =>
              ["Snap.", "Drop.", "Sold.", "·", "Bunq · me", "·", "Live now in NL", "·", "Zero seller fees", "·", "Settles in seconds", "·"].map((w, i) => (
                <Text key={`${copy}-${i}`} color={w === "·" ? G : TEXT} opacity={w === "·" ? 1 : 0.78}>{w}</Text>
              )),
            )}
          </Flex>
        </GlassCard>
      </Box>

      {/* How it works */}
      <Box id="how-it-works" px={{ base: "24px", md: "56px" }} py={{ base: "72px", md: "120px" }}>
        <Flex justify="space-between" align="baseline" mb={{ base: "40px", md: "64px" }}>
          <Text fontSize="13px" letterSpacing="0.18em" textTransform="uppercase" fontWeight="600">
            How it works
          </Text>
          <Text fontSize="13px" letterSpacing="0.18em" color={MUTED} fontVariantNumeric="tabular-nums">
            01 — 03
          </Text>
        </Flex>

        <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={{ base: "20px", md: "24px" }}>
          {STEPS.map((s) => (
            <GlassCard
              key={s.n}
              display="flex"
              flexDirection="column"
              borderRadius="20px"
              p={{ base: "28px", md: "32px" }}
              minH={{ md: "320px" }}
              transition="transform 220ms ease"
              _hover={{ transform: "translateY(-3px)" }}
            >
              <Text fontSize="12px" letterSpacing="0.22em" color={MUTED} fontVariantNumeric="tabular-nums" mb="20px" fontWeight="700">
                {s.n}
              </Text>
              <Text
                fontWeight="900"
                fontSize={{ base: "3.2rem", md: "4.2rem" }}
                letterSpacing="-0.045em"
                lineHeight="0.95"
                mb="20px"
                color={TEXT}
              >
                {s.t}
              </Text>
              <Text fontSize="15px" lineHeight="1.55" color={TEXT} opacity={0.82} maxW="320px">
                {s.body}
              </Text>
            </GlassCard>
          ))}
        </Box>
      </Box>

      {/* Editorial featured carousel — inverted */}
      <Box id="featured" bg={DARK} color={INK_FG} pt={{ base: "80px", md: "140px" }} pb={{ base: "80px", md: "120px" }} overflow="hidden">
        <Flex
          justify="space-between"
          align="flex-end"
          mb={{ base: "40px", md: "72px" }}
          gap="24px"
          wrap="wrap"
          px={{ base: "24px", md: "56px" }}
        >
          <Box>
            <Flex align="center" gap="12px" mb={{ base: "16px", md: "24px" }}>
              <Box h="10px" w="10px" borderRadius="full" bg={G} boxShadow={`0 0 0 6px ${G}2e`} />
              <Text fontSize="11px" letterSpacing="0.22em" textTransform="uppercase" fontWeight="700" color={G}>
                Live now
              </Text>
            </Flex>
            <Text
              as="h2"
              fontWeight="900"
              fontSize={{ base: "clamp(2.8rem, 13vw, 4.5rem)", md: "clamp(4rem, 8vw, 7.5rem)" }}
              letterSpacing="-0.045em"
              lineHeight="0.92"
            >
              Featured<br />drops.
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="11px" letterSpacing="0.22em" textTransform="uppercase" opacity={0.6} mb="6px">
              Streaming
            </Text>
            <Text fontWeight="900" fontSize="3.5rem" letterSpacing="-0.04em" lineHeight="0.9" fontVariantNumeric="tabular-nums">
              ∞ / <Box as="span" opacity={0.4}>{String(FEATURED.length).padStart(2, "0")}</Box>
            </Text>
          </Box>
        </Flex>

        <Box
          position="relative"
          _before={{
            content: '""', position: "absolute", top: 0, bottom: 0, left: 0, width: { base: "20px", md: "56px" },
            background: `linear-gradient(to right, ${dark ? "#f0f0f0" : "#0a0a0a"}, transparent)`,
            zIndex: 2, pointerEvents: "none",
          }}
          _after={{
            content: '""', position: "absolute", top: 0, bottom: 0, right: 0, width: { base: "20px", md: "56px" },
            background: `linear-gradient(to left, ${dark ? "#f0f0f0" : "#0a0a0a"}, transparent)`,
            zIndex: 2, pointerEvents: "none",
          }}
        >
          <Flex
            ref={carouselRef}
            gap={{ base: "20px", md: "32px" }}
            overflowX="auto"
            px={{ base: "24px", md: "56px" }}
            pb="8px"
            css={{
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
            }}
          >
            {[...FEATURED, ...FEATURED].map((s, idx) => (
              <Box
                key={`${s.n}-${idx}`}
                data-card
                role="group"
                cursor="pointer"
                flexShrink={0}
                width={{ base: "260px", md: "340px" }}
              >
                <Box position="relative" overflow="hidden" aspectRatio="3 / 4" mb="14px" bg="#171717">
                  <Box
                    as="img"
                    src={s.img}
                    alt={s.title}
                    loading="lazy"
                    w="full"
                    h="full"
                    objectFit="cover"
                    draggable={false}
                    transition="transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)"
                    _groupHover={{ transform: "scale(1.05)" }}
                  />
                  <Text
                    position="absolute"
                    top="14px"
                    left="14px"
                    color="#fff"
                    fontSize="12px"
                    fontWeight="800"
                    letterSpacing="0.2em"
                    mixBlendMode="difference"
                    fontVariantNumeric="tabular-nums"
                  >
                    {s.n}
                  </Text>
                  <Flex
                    position="absolute"
                    bottom="14px"
                    left="14px"
                    bg="rgba(255,255,255,0.96)"
                    color="#000"
                    px="10px"
                    py="6px"
                    align="center"
                    gap="6px"
                    fontSize="10px"
                    fontWeight="800"
                    letterSpacing="0.2em"
                    textTransform="uppercase"
                  >
                    <Box h="6px" w="6px" borderRadius="full" bg={G} />
                    Live
                  </Flex>
                </Box>
                <Text fontSize={{ base: "15px", md: "17px" }} fontWeight="700" letterSpacing="-0.015em" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {s.title}
                </Text>
                <Text fontSize="11px" letterSpacing="0.2em" textTransform="uppercase" opacity={0.55} mt="4px">
                  {s.place}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        <Flex
          mt={{ base: "24px", md: "40px" }}
          px={{ base: "24px", md: "56px" }}
          justify="space-between"
          align="center"
          gap="16px"
        >
          <Text fontSize="11px" letterSpacing="0.22em" textTransform="uppercase" opacity={0.55}>
            Auto-scrolling · drag, swipe, or use the arrows
          </Text>
          <Flex gap="12px">
            {([-1, 1] as const).map((dir) => (
              <Box
                key={dir}
                as="button"
                aria-label={dir === -1 ? "Previous" : "Next"}
                onClick={scrollCarousel(dir)}
                h="48px"
                w="48px"
                border="1.5px solid"
                borderColor={INK_FG}
                bg="transparent"
                color={INK_FG}
                cursor="pointer"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="20px"
                transition="all 150ms ease"
                _hover={{ bg: INK_FG, color: DARK }}
              >
                {dir === -1 ? "←" : "→"}
              </Box>
            ))}
          </Flex>
        </Flex>
      </Box>

      {/* Editorial pull-quote */}
      <Box px={{ base: "24px", md: "56px" }} py={{ base: "72px", md: "140px" }} borderTop="1px solid" borderColor={BORDER}>
        <Text fontSize="13px" letterSpacing="0.18em" textTransform="uppercase" fontWeight="600" mb={{ base: "28px", md: "40px" }}>
          Why FlashDrop
        </Text>
        <Text
          as="blockquote"
          fontWeight="900"
          fontSize={{ base: "clamp(2rem, 7vw, 3rem)", md: "clamp(3rem, 5vw, 5rem)" }}
          letterSpacing="-0.035em"
          lineHeight="1.05"
          maxW="1200px"
          color={TEXT}
        >
          “Most people sell from their phones already. Marketplaces just got in the way. We strip them out — leave the camera, the AI, and the bank.”
        </Text>
        <Text mt={{ base: "24px", md: "40px" }} fontSize="12px" letterSpacing="0.18em" textTransform="uppercase" color={MUTED}>
          — FlashDrop, Bunqathon 2026
        </Text>
      </Box>

      {/* Stats band — tiled cards */}
      <Box px={{ base: "24px", md: "56px" }} py={{ base: "56px", md: "88px" }}>
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
          gap={{ base: "16px", md: "20px" }}
        >
          {[
            ["28s", "Median time from snap to live drop"],
            ["100%", "Settled directly to your bunq account"],
            ["0", "Marketplace fees during the bunqathon"],
            ["1-tap", "Buyer checkout — scan and you're done"],
          ].map(([n, label], i) => (
            <GlassCard
              key={label}
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
              borderRadius="18px"
              p={{ base: "20px", md: "28px" }}
              minH={{ md: "240px" }}
              transition="transform 220ms ease"
              _hover={{ transform: "translateY(-3px)" }}
            >
              <Flex justify="space-between" align="flex-start">
                <Text fontSize="11px" letterSpacing="0.22em" textTransform="uppercase" fontWeight="700" color={MUTED} fontVariantNumeric="tabular-nums">
                  0{i + 1}
                </Text>
                <Box h="6px" w="6px" borderRadius="full" bg={G} />
              </Flex>
              <Box>
                <Text fontWeight="900" fontSize={{ base: "3.5rem", md: "4.4rem" }} letterSpacing="-0.045em" lineHeight="0.9" color={TEXT}>
                  {n}
                </Text>
                <Text mt="12px" fontSize="12px" letterSpacing="0.12em" textTransform="uppercase" color={MUTED} fontWeight="600">
                  {label}
                </Text>
              </Box>
            </GlassCard>
          ))}
        </Box>
      </Box>

      {/* FAQ-ish two-column */}
      <Box id="fine-print" px={{ base: "24px", md: "56px" }} py={{ base: "72px", md: "120px" }}>
        <Text fontSize="13px" letterSpacing="0.18em" textTransform="uppercase" fontWeight="600" mb={{ base: "32px", md: "56px" }}>
          The fine print
        </Text>
        <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={{ base: "20px", md: "24px" }}>
          {[
            ["Built for in-person", "Markets, fairs, garages, kitchen tables. Anywhere a buyer can scan."],
            ["Instant settlement", "bunq.me means your euros land in seconds, not days. No payouts to chase."],
            ["AI does the boring", "Title, description, fair price — generated. You stay in your flow."],
            ["Hackathon honest", "Sandbox mode in this demo. Real bunq integration on the roadmap."],
          ].map(([t, body]) => (
            <GlassCard
              key={t}
              display="flex"
              flexDirection="column"
              borderRadius="18px"
              p={{ base: "24px", md: "28px" }}
              transition="transform 220ms ease"
              _hover={{ transform: "translateY(-2px)" }}
            >
              <Text fontWeight="800" fontSize="22px" letterSpacing="-0.015em" mb="10px" color={TEXT}>
                {t}
              </Text>
              <Text fontSize="14px" lineHeight="1.6" color={TEXT} opacity={0.7}>
                {body}
              </Text>
            </GlassCard>
          ))}
        </Box>
      </Box>

      {/* Dark footer closure */}
      <Box bg={DARK} color={INK_FG} px={{ base: "24px", md: "56px" }} pt={{ base: "72px", md: "120px" }} pb={{ base: "32px", md: "48px" }}>
        <Flex justify="space-between" align="flex-end" gap="40px" wrap="wrap" mb={{ base: "56px", md: "88px" }}>
          <Text
            fontWeight="900"
            fontSize={{ base: "clamp(2.5rem, 13vw, 4.5rem)", md: "clamp(3.5rem, 7vw, 6rem)" }}
            letterSpacing="-0.045em"
            lineHeight="0.92"
          >
            Drop yours.<br />Right now.
          </Text>
          <Box
            as={Link}
            {...{ to: "/login" } as any}
            border="1.5px solid"
            borderColor={INK_FG}
            px="28px"
            py="18px"
            fontWeight="700"
            fontSize="14px"
            letterSpacing="0.04em"
            textTransform="uppercase"
            display="inline-flex"
            alignItems="center"
            gap="10px"
            color={INK_FG}
            _hover={{ bg: INK_FG, color: DARK }}
            transition="all 150ms ease"
          >
            Sign in to start <Box as="span">→</Box>
          </Box>
        </Flex>

        <Flex
          justify="space-between"
          gap="32px"
          wrap="wrap"
          pt="32px"
          borderTop="1px solid"
          borderColor="rgba(255,255,255,0.18)"
          fontSize="11px"
          letterSpacing="0.16em"
          textTransform="uppercase"
          opacity={0.6}
        >
          <Text>FlashDrop · Bunqathon 2026 · Amsterdam</Text>
          <Flex gap="24px" wrap="wrap">
            <Box as="a" href={"https://github.com/leyk3po/bunqathon"} _hover={{ opacity: 1 }}>GitHub ↗</Box>
            <Box as="a" href={"https://doc.bunq.com"} _hover={{ opacity: 1 }}>Bunq Docs ↗</Box>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
