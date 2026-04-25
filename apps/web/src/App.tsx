import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Box, Flex, Grid, Image, Link, QrCode, SimpleGrid, Spinner, Text, Textarea } from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, buyerCheckoutUrl, centsFromEuros, clearAuth, dataUrlToBlob, eurosFromCents, getStoredSeller, persistAuth, persistSeller, type DropDetail, type DropPublic, type DropState, type SellerPublic } from "./api";
import { G, DARK, INK_FG, BG, SURFACE, CARD, BORDER, TEXT, MUTED, FONT, PANEL } from "./theme/tokens";
import { BunqWordmark } from "./components/BunqWordmark";
import { GlassCard } from "./components/GlassCard";
import { ProductTileImage } from "./components/ProductTileImage";
import { VoiceWave } from "./components/VoiceWave";
import { PaymentCelebration, type CelebrationData } from "./components/PaymentCelebration";
import { ListingCard, type Listing } from "./components/ListingCard";
import { EditModal } from "./components/EditModal";

// ─── Shared primitive styles ──────────────────────────────────────────────────
const inputBase = {
  fontFamily: FONT, fontSize: "14px", color: TEXT, bg: CARD,
  border: "1px solid", borderColor: BORDER, borderRadius: "8px",
  px: "12px", h: "44px", w: "full", outline: "none",
  _focus: { borderColor: DARK, boxShadow: "none" },
  _focusVisible: { borderColor: DARK, boxShadow: "none" },
} as const;

const btnPrimary = {
  fontFamily: FONT, fontSize: "14px", fontWeight: "600",
  bg: DARK, color: INK_FG, border: "none", borderRadius: "8px",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  transition: "opacity 150ms ease",
  _hover: { opacity: 0.88 },
} as const;

const btnOutline = {
  fontFamily: FONT, fontSize: "14px", fontWeight: "500",
  bg: CARD, color: TEXT,
  border: "1px solid", borderColor: BORDER, borderRadius: "8px",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  _hover: { bg: SURFACE },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dropToListing(drop: DropPublic): Listing {
  const status =
    drop.state === "live" || drop.state === "partially_sold" ? "live" as const
    : drop.state === "sold_out" ? "sold" as const
    : "draft" as const;
  return {
    id: drop.id, slug: drop.slug, title: drop.title,
    description: drop.description ?? "", price: eurosFromCents(drop.price_cents),
    stock: drop.inventory, category: "FlashDrop",
    imageUrl: drop.media_url ?? "", prompt: "", status, state: drop.state,
    createdAt: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(drop.created_at)),
    bunqTabUrl: drop.bunq_tab_url,
  };
}

function nowTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function checkoutStatusFromState(state: DropState): "ready" | "paid" | "unavailable" {
  if (state === "sold_out" || state === "partially_sold") return "paid";
  if (state === "live") return "ready";
  return "unavailable";
}

function dropStateLabel(state: DropState): string {
  switch (state) {
    case "live": return "Live now";
    case "partially_sold": return "Selling fast";
    case "sold_out": return "Sold out";
    case "paused": return "Paused";
    case "review":
    case "processing": return "Preparing";
    case "expired": return "Expired";
    case "archived": return "Archived";
    default: return "Draft";
  }
}

function titleFromPrompt(p: string) {
  const words = p.trim().replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "New drop";
}

function makeLocalDraft(d: DraftListing): DraftListing {
  const p = d.prompt.toLowerCase();
  return {
    ...d,
    title: d.title || titleFromPrompt(d.prompt),
    description: d.description || `${d.prompt} — limited drop, ready now.`,
    price: p.includes("jacket") || p.includes("vintage") ? "34.00" : p.includes("cookie") ? "8.50" : d.price || "",
    stock: d.stock || 1,
  };
}

type DraftListing = {
  imageUrl: string; prompt: string; title: string;
  description: string; price: string; stock: number;
  category: string; audioUrl?: string;
};

const emptyDraft: DraftListing = {
  imageUrl: "", prompt: "", title: "", description: "", price: "", stock: 1, category: "Quick drop",
};

// ─── Theme toggle ─────────────────────────────────────────────────────────────
function useTheme() {
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
      w="32px" h="32px"
      borderRadius="50%"
      bg={SURFACE}
      border="1px solid"
      borderColor={BORDER}
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      flexShrink={0}
      _hover={{ bg: BORDER }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
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

// ─── Micro icon components ────────────────────────────────────────────────────
function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8.25 6.75 9.7 5h4.6l1.45 1.75H19A2.25 2.25 0 0 1 21.25 9v7A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V9A2.25 2.25 0 0 1 5 6.75h3.25Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconMic({ on }: { on?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 14.25A3.25 3.25 0 0 0 15.25 11V6.5a3.25 3.25 0 0 0-6.5 0V11A3.25 3.25 0 0 0 12 14.25Z" stroke="currentColor" strokeWidth={on ? "2.2" : "1.7"} />
      <path d="M5.75 10.75a6.25 6.25 0 0 0 12.5 0M12 17v3.25M8.75 20.25h6.5" stroke="currentColor" strokeLinecap="round" strokeWidth={on ? "2.2" : "1.7"} />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" fill="currentColor" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Dot cluster (animated background element on login) ──────────────────────
// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getStoredSeller()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    if (mode === "register" && displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      setSubmitting(false);
      return;
    }
    if (email.trim().length < 5) {
      setError("Enter a valid email address.");
      setSubmitting(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }
    try {
      const auth = mode === "register"
        ? await api.registerSeller({ email: email.trim(), display_name: displayName.trim(), password })
        : await api.loginSeller({ email: email.trim(), password });
      persistAuth(auth);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex
      minH="100dvh"
      bg={BG}
      align="center"
      justify="center"
      position="relative"
      overflow="hidden"
      p={{ base: "24px", md: "40px" }}
    >
      {/* Mesh gradient background */}
      <Box className="login-bg">
        <Box className="lorb lorb-1" />
        <Box className="lorb lorb-2" />
        <Box className="lorb lorb-3" />
        <Box className="lorb lorb-4" />
      </Box>

      {/* Theme toggle */}
      <Box position="absolute" top="20px" right="20px" zIndex={10}>
        <ThemeToggle dark={dark} toggle={toggle} />
      </Box>

      {/* Content */}
      <Flex direction="column" align="center" w="full" maxW="400px" position="relative" zIndex={1}>
        {/* Wordmark */}
        <Text
          className="login-logo-in"
          fontFamily={FONT} fontWeight="700" fontSize="18px"
          color={TEXT} letterSpacing="-0.5px" mb="28px"
        >
          FlashDrop
        </Text>

        {/* Card */}
        <GlassCard className="login-card-in" w="full" borderRadius="20px" p={{ base: "28px", md: "36px" }}>
          <Text fontFamily={FONT} fontSize="22px" fontWeight="700" color={TEXT} letterSpacing="-0.5px" mb="6px">
            {mode === "register" ? "Create seller account" : "Seller sign in"}
          </Text>
          <Text fontFamily={FONT} fontSize="14px" color={MUTED} mb="28px" lineHeight={1.6}>
            Use a real seller login so your drops stay attached to your account across sessions.
          </Text>

          <Box display="flex" flexDirection="column" gap="10px">
            {mode === "register" && (
              <Box
                as="input"
                {...inputBase as any}
                h="46px"
                borderRadius="10px"
                {...{ placeholder: "Display name or booth" } as any}
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
              />
            )}
            <Box
              as="input"
              {...inputBase as any}
              h="46px"
              borderRadius="10px"
              type="email"
              {...{ placeholder: "Email" } as any}
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
            />
            <Box
              as="input"
              {...inputBase as any}
              h="46px"
              borderRadius="10px"
              type="password"
              {...{ placeholder: "Password" } as any}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
            />
            {error && (
              <Text fontFamily={FONT} fontSize="13px" color="red.500">
                {error}
              </Text>
            )}
            <Box
              as="button"
              {...btnPrimary}
              h="46px" gap="8px"
              borderRadius="10px"
              _hover={{ opacity: 0.88, transform: "translateY(-1px)", boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}
              opacity={submitting ? 0.7 : 1}
              cursor={submitting ? "not-allowed" : "pointer"}
              onClick={submitting ? undefined : submit}
            >
              {submitting ? "Working..." : mode === "register" ? "Create account" : "Sign in"} {!submitting && <IconArrow />}
            </Box>
          </Box>

          <Box
            as="button"
            fontFamily={FONT} fontSize="13px" fontWeight="500"
            bg="transparent" color={MUTED}
            border="none" cursor="pointer" w="full" mt="16px" h="32px"
            _hover={{ color: TEXT }}
            transition="color 150ms ease"
            onClick={() => { setError(""); setMode((m) => m === "login" ? "register" : "login"); }}
          >
            {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
          </Box>
        </GlassCard>

        <Text
          className="login-card-in"
          fontFamily={FONT} fontSize="12px" color={MUTED}
          mt="24px" textAlign="center" letterSpacing="0.02em"
        >
          camera · voice · AI listing · bunq payments
        </Text>
      </Flex>
    </Flex>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardPage() {
  const navigate                   = useNavigate();
  const { dark, toggle }           = useTheme();
  const [seller, setSeller]        = useState<SellerPublic | null>(() => getStoredSeller());
  const [listings, setListings]    = useState<Listing[]>([]);
  const [loading, setLoading]      = useState(true);
  const [loadError, setLoadError]  = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editTarget, setEditTarget]   = useState<Listing | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const sellerId = seller?.id ?? "";
  const sellerName = seller?.display_name ?? "";

  const liveCount  = listings.filter((l) => l.status === "live").length;
  const stockCount = listings.reduce((t, l) => t + l.stock, 0);
  const soldCount  = listings.filter((l) => l.status === "sold").length;

  useEffect(() => {
    if (!sellerId) {
      navigate("/", { replace: true });
      return;
    }
    api.getMe()
      .then((me) => {
        persistSeller(me);
        setSeller(me);
      })
      .catch(() => {
        clearAuth();
        navigate("/", { replace: true });
      });
  }, [navigate, sellerId]);

  const fetchDrops = useCallback(async () => {
    if (!sellerId) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true); setLoadError("");
    try {
      const drops = await api.listDrops({ seller_id: sellerId || undefined, limit: 100 });
      setListings(drops.filter((d) => d.state !== "archived").map(dropToListing));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not reach backend.");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { fetchDrops(); }, [fetchDrops]);

  const updateListing = useCallback((id: string, u: Partial<Listing>) => {
    setListings((cur) => cur.map((l) => l.id === id ? { ...l, ...u } : l));
  }, []);

  return (
    <Box bg={BG} minH="100dvh" pb="120px" position="relative">
      {/* Animated gradient background */}
      <Box className="grad-bg">
        <Box className="grad-orb orb-1" />
        <Box className="grad-orb orb-2" />
        <Box className="grad-orb orb-3" />
      </Box>

      {/* Nav — liquid glass */}
      <Box
        className="glass-nav"
        position="sticky"
        top={0}
        zIndex={10}
        px={{ base: "20px", md: "40px" }}
        h="60px"
        display="flex"
        alignItems="center"
      >
        <Flex align="center" justify="space-between" w="full" maxW="1200px" mx="auto">
          {/* Wordmark */}
          <BunqWordmark />

          {/* Right controls */}
          <Flex align="center" gap="8px" flexShrink={0}>
            {/* Seller avatar pill */}
            {sellerName && (
              <Flex
                display={{ base: "none", sm: "flex" }}
                align="center" gap="8px"
                px="10px" h="32px"
                bg={SURFACE}
                border="1px solid"
                borderColor={BORDER}
                borderRadius="20px"
              >
                <Box
                  w="18px" h="18px" borderRadius="50%"
                  bg={BORDER}
                  display="flex" alignItems="center" justifyContent="center"
                  flexShrink={0}
                >
                  <Text fontFamily={FONT} fontSize="10px" fontWeight="700" color={TEXT} lineHeight={1}>
                    {sellerName[0]?.toUpperCase()}
                  </Text>
                </Box>
                <Text
                  fontFamily={FONT} fontSize="12px" fontWeight="500" color={MUTED}
                  overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
                  maxW="120px"
                >
                  {sellerName}
                </Text>
              </Flex>
            )}

            <ThemeToggle dark={dark} toggle={toggle} />

            <Box
              as="button"
              {...btnOutline}
              h="32px"
              px="12px"
              gap="6px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              onClick={() => { clearAuth(); navigate("/", { replace: true }); }}
              _hover={{ color: "red.500" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 3h7a2 2 0 0 1 2 2v2h-2V5H5v14h7v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="currentColor" />
                <path d="M16 8l4 4-4 4v-3H9v-2h7V8Z" fill="currentColor" />
              </svg>
              <Text fontFamily={FONT} fontSize="12px" fontWeight="500">Log out</Text>
            </Box>
          </Flex>
        </Flex>
      </Box>

      {/* Page body */}
      <Box maxW="1200px" mx="auto" px={{ base: "16px", md: "40px" }} py={{ base: "24px", md: "32px" }} position="relative" zIndex={1}>

        {/* Stats */}
        <SimpleGrid columns={3} gap={{ base: "10px", md: "16px" }} mb={{ base: "24px", md: "32px" }}>
          {[
            { label: "Live drops", value: liveCount },
            { label: "In stock",   value: stockCount },
            { label: "Sold out",   value: soldCount },
          ].map(({ label, value }) => (
            <GlassCard
              key={label}
              borderRadius="12px"
              p={{ base: "14px", md: "20px" }}
            >
              <Text fontFamily={FONT} fontSize={{ base: "10px", md: "11px" }} fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">
                {label}
              </Text>
              <Text
                fontFamily={FONT}
                fontSize={{ base: "24px", md: "32px" }}
                fontWeight="700"
                color={TEXT}
                letterSpacing="-1px"
                lineHeight={1}
              >
                {value}
              </Text>
            </GlassCard>
          ))}
        </SimpleGrid>

        {/* Section header */}
        <Flex align="center" justify="space-between" mb="16px">
          <Box>
            <Text fontFamily={FONT} fontSize="16px" fontWeight="600" color={TEXT}>Listings</Text>
            <Text fontFamily={FONT} fontSize="13px" color={MUTED} mt="2px">
              {loading ? "Loading…" : loadError || `${listings.length} total`}
            </Text>
          </Box>
          <Box
            as="button"
            {...btnOutline}
            h="34px"
            px="14px"
            fontSize="13px"
            onClick={fetchDrops}
            opacity={loading ? 0.6 : 1}
          >
            {loading ? <Spinner size="xs" /> : "Refresh"}
          </Box>
        </Flex>

        {/* Grid */}
        {loading ? (
          <Flex justify="center" py="80px"><Spinner size="xl" /></Flex>
        ) : listings.length === 0 ? (
          <GlassCard borderRadius="12px" p="64px 24px" textAlign="center">
            <Text fontFamily={FONT} fontSize="16px" fontWeight="600" color={TEXT} mb="6px">No listings yet</Text>
            <Text fontFamily={FONT} fontSize="14px" color={MUTED}>Tap the button below to create your first drop.</Text>
          </GlassCard>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={{ base: "12px", md: "16px" }}>
            {listings.map((l) => (
              <ListingCard
                key={l.id} listing={l}
                onUpdate={(u) => updateListing(l.id, u)}
                onEdit={() => setEditTarget(l)}
                onCelebrate={setCelebration}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* FAB */}
      <Box
        position="fixed" bottom="28px" left={0} right={0}
        display="flex" justifyContent="center" zIndex={20}
        pointerEvents="none"
      >
        <Box
          as="button"
          className="glass-card"
          w="60px" h="60px"
          borderRadius="50%"
          cursor="pointer"
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="auto"
          border="none"
          color={TEXT}
          transition="transform 200ms ease, box-shadow 200ms ease"
          _hover={{ transform: "translateY(-3px) scale(1.06)" }}
          _active={{ transform: "scale(0.94)", transition: "transform 80ms ease" }}
          onClick={() => setCaptureOpen(true)}
        >
          <IconCamera />
        </Box>
      </Box>

      {captureOpen && (
        <CaptureOverlay
          onClose={() => setCaptureOpen(false)}
          onPost={(l) => setListings((cur) => [l, ...cur])}
        />
      )}
      {editTarget && (
        <EditModal
          listing={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(u) => { updateListing(editTarget.id, u); setEditTarget(null); }}
          onArchive={() => { setListings((cur) => cur.filter((l) => l.id !== editTarget.id)); setEditTarget(null); }}
        />
      )}
      {celebration && <PaymentCelebration data={celebration} onDone={() => setCelebration(null)} />}
    </Box>
  );
}

// ─── Capture overlay ──────────────────────────────────────────────────────────
type CaptureProps = { onClose: () => void; onPost: (l: Listing) => void };

function CaptureOverlay({ onClose, onPost }: CaptureProps) {
  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const recognitionRef  = useRef<{ stop: () => void } | null>(null);
  const audioChunksRef  = useRef<Blob[]>([]);
  const capturedBlobRef = useRef<Blob | null>(null);
  const remoteMediaRef  = useRef<string | null>(null);

  const [draft, setDraft]           = useState<DraftListing>(emptyDraft);
  const [cameraError, setCameraErr] = useState("");
  const [apiError, setApiError]     = useState("");
  const [isUploading, setUploading] = useState(false);
  const [isGenerating, setGen]      = useState(false);
  const [isPosting, setPosting]     = useState(false);
  const [isRecording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const hasPhoto    = Boolean(draft.imageUrl);
  const canGenerate = hasPhoto || draft.prompt.trim().length > 0;
  const SpeechRecognitionCtor =
    typeof window === "undefined"
      ? null
      : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);
  const supportsDeviceTranscription = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: true })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraErr("Camera blocked — upload a photo instead."));
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const capturePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280; canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setDraft((d) => ({ ...d, imageUrl: dataUrl }));
    canvas.toBlob((blob) => { capturedBlobRef.current = blob; remoteMediaRef.current = null; }, "image/jpeg", 0.92);
  };

  const retakePhoto = () => {
    setDraft((d) => ({ ...d, imageUrl: "" }));
    capturedBlobRef.current = null; remoteMediaRef.current = null;
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    capturedBlobRef.current = file; remoteMediaRef.current = null;
    setDraft((d) => ({ ...d, imageUrl: URL.createObjectURL(file) }));
    setUploading(true);
    try { const r = await api.uploadMedia(file, file.name); remoteMediaRef.current = r.url; }
    catch { /* retry later */ } finally { setUploading(false); }
  };

  const ensureUploaded = async () => {
    if (remoteMediaRef.current) return remoteMediaRef.current;
    if (!capturedBlobRef.current) return null;
    const ext = capturedBlobRef.current.type.split("/")[1] ?? "jpg";
    const r = await api.uploadMedia(capturedBlobRef.current, `capture-${Date.now()}.${ext}`);
    remoteMediaRef.current = r.url; return r.url;
  };

  const startVoice = async () => {
    setRecording(true);
    setVoiceError("");
    audioChunksRef.current = [];
    if (SpeechRecognitionCtor) {
      const r = new SpeechRecognitionCtor();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.onresult = (ev: any) => {
        const t = Array.from(ev.results as any[]).map((x: any) => x[0]?.transcript ?? "").join(" ").trim();
        if (t) setDraft((d) => ({ ...d, prompt: t }));
      };
      r.onerror = () => {
        setVoiceError("Device transcription failed. Type the pitch manually if needed.");
      };
      r.start(); recognitionRef.current = r;
    } else {
      setVoiceError("Device transcription is not supported in this browser. You can still record audio and type the pitch.");
    }
    try {
      const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const mimeType = (rec.mimeType || audioChunksRef.current[0]?.type || "audio/webm").split(";", 1)[0];
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setDraft((d) => ({ ...d, audioUrl: blob.size > 0 ? URL.createObjectURL(blob) : d.audioUrl }));
      };
      rec.start(); recorderRef.current = rec;
    } catch {
      setRecording(false);
      recognitionRef.current?.stop();
      setVoiceError("Microphone unavailable on this device.");
    }
  };

  const stopVoice = () => { recorderRef.current?.stop(); recognitionRef.current?.stop(); setRecording(false); };

  const generateListing = async () => {
    setGen(true); setApiError("");
    try {
      if (!capturedBlobRef.current && draft.imageUrl.startsWith("data:")) capturedBlobRef.current = await dataUrlToBlob(draft.imageUrl);
      const mediaUrl = await ensureUploaded();
      const pitch = draft.prompt.trim() || "Limited drop, available now.";
      const preview = await api.generatePreview(pitch, mediaUrl);
      setDraft((d) => ({ ...d, title: preview.title, description: preview.description, price: eurosFromCents(preview.price_cents) }));
    } catch {
      setApiError("AI unavailable — fill in the details below.");
      setDraft((d) => makeLocalDraft(d));
    } finally { setGen(false); }
  };

  const postListing = async () => {
    setPosting(true); setApiError("");
    try {
      if (!capturedBlobRef.current && draft.imageUrl.startsWith("data:")) capturedBlobRef.current = await dataUrlToBlob(draft.imageUrl);
      const mediaUrl = await ensureUploaded();
      const created  = await api.createDrop({ title: draft.title.trim() || titleFromPrompt(draft.prompt), description: draft.description.trim(), pitch: draft.prompt.trim() || null, price_cents: centsFromEuros(draft.price), inventory: Math.max(1, draft.stock), media_url: mediaUrl });
      const reviewed = await api.moveToReview(created.id);
      const live     = await api.publish(reviewed.id);
      onPost({ id: live.id, slug: live.slug, title: live.title, description: live.description, price: eurosFromCents(live.price_cents), stock: live.inventory, category: draft.category, imageUrl: draft.imageUrl, prompt: draft.prompt, status: "live", createdAt: nowTime(), audioUrl: draft.audioUrl, bunqTabUrl: live.bunq_tab_url });
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Publish failed");
    } finally { setPosting(false); }
  };

  return (
    <Flex
      align="center"
      bg="rgba(0,0,0,0.55)"
      bottom={0} left={0} right={0} top={0}
      justify="center"
      p={{ base: "0", md: "24px" }}
      position="fixed"
      zIndex={30}
      style={{ backdropFilter: "blur(6px)" }}
    >
      <Box
        bg={CARD}
        border="1px solid"
        borderColor={BORDER}
        boxShadow="0 8px 40px rgba(0,0,0,0.18)"
        borderRadius={{ base: "0", md: "16px" }}
        w="full"
        maxW="1040px"
        maxH={{ base: "100dvh", md: "calc(100dvh - 48px)" }}
        overflow="auto"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px={{ base: "16px", md: "24px" }}
          py="16px"
          borderBottom="1px solid"
          borderColor={BORDER}
          gap="12px"
          position="sticky"
          top={0}
          className="glass-nav"
          zIndex={1}
        >
          <Flex align="center" gap="12px" flex={1} minW={0}>
            <BunqWordmark />
            <Box h="16px" w="1px" bg={BORDER} flexShrink={0} />
            <Text fontFamily={FONT} fontSize="14px" fontWeight="500" color={MUTED} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              New drop
            </Text>
          </Flex>
          <Box
            as="button"
            w="32px" h="32px" flexShrink={0}
            bg={SURFACE} borderRadius="50%"
            border="none" cursor="pointer"
            display="flex" alignItems="center" justifyContent="center"
            fontFamily={FONT} fontSize="18px" color={MUTED}
            _hover={{ bg: BORDER }}
            onClick={onClose}
          >
            ×
          </Box>
        </Flex>

        {/* Body */}
        <Grid
          templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
          gap={0}
        >
          {/* Left: camera */}
          <Box
            borderRight={{ lg: "1px solid" }}
            borderColor={BORDER}
            p={{ base: "16px", md: "24px" }}
          >
            {/* Camera view */}
            <Box
              bg={PANEL}
              borderRadius="10px"
              overflow="hidden"
              position="relative"
              mb="12px"
            >
              {hasPhoto ? (
                <Image alt="Captured" h={{ base: "280px", md: "380px" }} objectFit="cover" src={draft.imageUrl} w="full" display="block" />
              ) : (
                <video autoPlay muted playsInline ref={videoRef}
                  style={{ background: "#111", display: "block", height: "min(380px, 50vh)", objectFit: "cover", width: "100%" }}
                />
              )}
              <Box position="absolute" bottom="10px" left="10px">
                <Box
                  bg="rgba(0,0,0,0.55)" borderRadius="20px" px="10px" py="4px"
                  style={{ backdropFilter: "blur(8px)" }}
                >
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="white">
                    {cameraError ? cameraError : hasPhoto ? (isUploading ? "Uploading…" : "Ready") : "Camera live"}
                  </Text>
                </Box>
              </Box>
            </Box>

            {/* Camera controls */}
            <Flex gap="8px" flexWrap="wrap" mb="16px">
              {!hasPhoto ? (
                <Box as="button" {...btnPrimary} h="38px" px="16px" fontSize="13px" gap="6px" onClick={capturePhoto}>
                  Capture
                </Box>
              ) : (
                <Box as="button" {...btnOutline} h="38px" px="16px" fontSize="13px" onClick={retakePhoto}>
                  Retake
                </Box>
              )}
              <Box as="label" {...btnOutline} h="38px" px="16px" fontSize="13px" cursor="pointer">
                Upload photo
                <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleUpload} />
              </Box>
              <Box
                as="button"
                h="38px" px="16px"
                bg={isRecording ? "rgba(220,38,38,0.08)" : CARD}
                color={isRecording ? "#ef4444" : TEXT}
                border="1px solid"
                borderColor={isRecording ? "rgba(220,38,38,0.3)" : BORDER}
                borderRadius="8px"
                fontFamily={FONT} fontSize="13px" fontWeight="500"
                cursor="pointer"
                display="flex" alignItems="center" gap="6px"
                onClick={isRecording ? stopVoice : startVoice}
              >
                <IconMic on={isRecording} />
                {isRecording ? "Stop" : "Voice pitch"}
              </Box>
            </Flex>

            {/* Waveform */}
            <Box
              bg={isRecording ? "rgba(0,213,75,0.06)" : SURFACE}
              border="1px solid"
              borderColor={isRecording ? "rgba(0,213,75,0.2)" : BORDER}
              borderRadius="10px"
              p="16px"
              transition="all 250ms ease"
            >
              <VoiceWave active={isRecording} />
            </Box>

            {draft.audioUrl && (
              <Box mt="10px">
                <audio controls src={draft.audioUrl} style={{ width: "100%", borderRadius: "8px" }} />
              </Box>
            )}

            {(voiceError || !supportsDeviceTranscription) && (
              <Text mt="10px" fontFamily={FONT} fontSize="12px" color={voiceError ? "#dc2626" : MUTED}>
                {voiceError || "Device transcription is unavailable here. Type the pitch manually."}
              </Text>
            )}
          </Box>

          {/* Right: pitch + form */}
          <Box p={{ base: "16px", md: "24px" }} display="flex" flexDirection="column" gap="16px">
            {/* Pitch */}
            <Box>
              <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">
                Pitch
              </Text>
              <Textarea
                fontFamily={FONT} fontSize="14px" color={TEXT}
                bg={CARD} border="1px solid" borderColor={BORDER}
                borderRadius="8px" p="12px" minH="100px" resize="none"
                placeholder="Describe the item — what it is, why someone should buy it, price hint…"
                value={draft.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                _focus={{ borderColor: DARK, boxShadow: "none" }}
                _focusVisible={{ borderColor: DARK, boxShadow: "none" }}
              />
              <Box
                as="button"
                {...btnOutline}
                h="38px" px="16px" mt="8px"
                fontSize="13px" gap="6px"
                display="flex" alignItems="center"
                opacity={canGenerate && !isGenerating ? 1 : 0.5}
                cursor={canGenerate && !isGenerating ? "pointer" : "not-allowed"}
                onClick={canGenerate && !isGenerating ? generateListing : undefined}
                w="full" justifyContent="center"
              >
                {isGenerating ? <Spinner size="xs" /> : <IconSpark />}
                {isGenerating ? "Generating…" : "Generate with AI"}
              </Box>
            </Box>

            {/* Listing fields */}
            <Box display="flex" flexDirection="column" gap="12px">
              <Box>
                <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">Title</Text>
                <Box as="input" {...inputBase as any} value={draft.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </Box>

              <Grid templateColumns="1fr 1fr" gap="10px">
                <Box>
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">Price (EUR)</Text>
                  <Box as="input" {...inputBase as any} placeholder="0.00" value={draft.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                </Box>
                <Box>
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">Stock</Text>
                  <Box as="input" type="number" min={0} {...inputBase as any} value={draft.stock} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, stock: Math.max(0, Number(e.target.value)) }))} />
                </Box>
              </Grid>

              <Box>
                <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">Description</Text>
                <Textarea
                  fontFamily={FONT} fontSize="14px" color={TEXT}
                  bg={CARD} border="1px solid" borderColor={BORDER}
                  borderRadius="8px" p="12px" minH="80px" resize="none"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  _focus={{ borderColor: DARK, boxShadow: "none" }}
                  _focusVisible={{ borderColor: DARK, boxShadow: "none" }}
                />
              </Box>
            </Box>

            {apiError && (
              <Text fontFamily={FONT} fontSize="13px" color="#dc2626">{apiError}</Text>
            )}

            <Box
              as="button"
              {...btnPrimary}
              h="48px" mt="auto"
              fontSize="14px"
              opacity={isPosting || !canGenerate ? 0.6 : 1}
              cursor={isPosting || !canGenerate ? "not-allowed" : "pointer"}
              onClick={!isPosting && canGenerate ? postListing : undefined}
              gap="8px"
            >
              {isPosting && <Spinner size="xs" />}
              {isPosting ? "Publishing…" : "Publish to bunq"}
              {!isPosting && <IconArrow />}
            </Box>
          </Box>
        </Grid>
      </Box>
    </Flex>
  );
}

type WallActivity = {
  id: string;
  text: string;
  time: string;
  tone: "sale" | "state" | "info";
};

function LiveWallPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<DropDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<WallActivity[]>([]);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const dropRef = useRef<DropDetail | null>(null);

  useEffect(() => {
    dropRef.current = drop;
  }, [drop]);

  useEffect(() => {
    let active = true;

    const pushActivity = (text: string, tone: WallActivity["tone"]) => {
      if (!active) return;
      setActivity((current) => [
        { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, text, tone, time: nowTime() },
        ...current,
      ].slice(0, 6));
    };

    setLoading(true);
    setError("");
    setActivity([]);

    api.getDrop(slug)
      .then((result) => {
        if (!active) return;
        setDrop(result);
        pushActivity(
          result.state === "live" || result.state === "partially_sold"
            ? "Wall ready. Buyers can scan and pay now."
            : `Drop is ${dropStateLabel(result.state).toLowerCase()}.`,
          "info",
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load live wall");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const es = api.streamDrop(slug);

    es.addEventListener("snapshot", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as Partial<DropDetail>;
        setDrop((current) => current ? {
          ...current,
          title: data.title ?? current.title,
          slug: data.slug ?? current.slug,
          state: (data.state as DropState | undefined) ?? current.state,
          inventory: typeof data.inventory === "number" ? data.inventory : current.inventory,
          sold_count: typeof data.sold_count === "number" ? data.sold_count : current.sold_count,
          price_cents: typeof data.price_cents === "number" ? data.price_cents : current.price_cents,
          currency: data.currency ?? current.currency,
          media_url: data.media_url ?? current.media_url,
          bunq_tab_url: data.bunq_tab_url ?? current.bunq_tab_url,
        } : current);
      } catch {
        // ignore malformed SSE snapshot payloads
      }
    });

    es.addEventListener("published", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { state?: DropState; bunq_tab_url?: string | null };
        setDrop((current) => current ? {
          ...current,
          state: data.state ?? current.state,
          bunq_tab_url: data.bunq_tab_url ?? current.bunq_tab_url,
        } : current);
        pushActivity("Storefront pushed live. QR is ready for the room.", "state");
      } catch {
        // ignore malformed published payloads
      }
    });

    es.addEventListener("state_changed", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { state?: DropState; inventory?: number };
        const nextState = data.state;
        setDrop((current) => current ? {
          ...current,
          state: nextState ?? current.state,
          inventory: typeof data.inventory === "number" ? data.inventory : current.inventory,
        } : current);
        if (nextState) {
          pushActivity(`Drop status changed to ${dropStateLabel(nextState).toLowerCase()}.`, "state");
        }
      } catch {
        // ignore malformed state payloads
      }
    });

    es.addEventListener("payment", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          drop_state?: DropState;
          inventory?: number;
          sold_count?: number;
        };
        const current = dropRef.current;
        const nextInventory = typeof data.inventory === "number" ? data.inventory : current?.inventory ?? 0;
        const nextState = data.drop_state ?? current?.state ?? "live";
        setDrop((existing) => existing ? {
          ...existing,
          state: nextState,
          inventory: nextInventory,
          sold_count: typeof data.sold_count === "number" ? data.sold_count : existing.sold_count + 1,
        } : existing);
        pushActivity(`${current?.title ?? "Drop"} sold. ${nextInventory} left in stock.`, "sale");
        if (current) {
          setCelebration({
            title: current.title,
            amount: `€ ${eurosFromCents(current.price_cents)}`,
          });
        }
      } catch {
        // ignore malformed payment payloads
      }
    });

    return () => {
      active = false;
      es.close();
    };
  }, [slug]);

  if (loading) {
    return <Flex minH="100dvh" bg={PANEL} align="center" justify="center"><Spinner size="xl" color="white" /></Flex>;
  }

  if (!drop) {
    return (
      <Flex minH="100dvh" bg={PANEL} align="center" justify="center" p={{ base: 4, md: 8 }}>
        <Box
          bg="rgba(8,14,20,0.92)"
          border="1px solid rgba(255,255,255,0.12)"
          borderRadius="28px"
          p={{ base: "28px", md: "36px" }}
          maxW="480px"
          w="full"
          boxShadow="0 32px 80px rgba(0,0,0,0.45)"
        >
          <Text fontFamily={FONT} fontSize="12px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.14em">
            Live wall
          </Text>
          <Text fontFamily={FONT} fontSize="30px" fontWeight="700" color="white" letterSpacing="-1px" mt="12px">
            This wall is unavailable
          </Text>
          <Text fontFamily={FONT} fontSize="15px" color="whiteAlpha.700" mt="12px" lineHeight="1.6">
            {error || "The requested drop could not be loaded."}
          </Text>
          <Box
            as="button"
            {...btnPrimary}
            mt="24px"
            h="48px"
            w="full"
            onClick={() => navigate("/dashboard")}
          >
            Back to dashboard
          </Box>
        </Box>
      </Flex>
    );
  }

  const checkoutUrl = buyerCheckoutUrl(drop.slug);
  const stateLabel = dropStateLabel(drop.state);
  const ctaLabel =
    drop.state === "sold_out" ? "Sold out"
    : drop.state === "paused" ? "Paused"
    : drop.state === "review" || drop.state === "draft" ? "Preparing to go live"
    : "Scan to pay instantly";

  return (
    <Box minH="100dvh" bg={PANEL} color="white" position="relative" overflow="hidden">
      <Box
        position="absolute"
        inset={0}
        bg="radial-gradient(circle at 14% 18%, rgba(0,213,75,0.18), transparent 32%), radial-gradient(circle at 85% 18%, rgba(62,137,255,0.17), transparent 28%), radial-gradient(circle at 50% 92%, rgba(255,157,64,0.20), transparent 34%), linear-gradient(180deg, #04080c 0%, #09131b 42%, #071018 100%)"
      />
      <Box
        position="absolute"
        insetX="-10%"
        top="-24%"
        h="420px"
        bg="radial-gradient(circle, rgba(255,255,255,0.18), transparent 60%)"
        transform="rotate(-8deg)"
        opacity={0.28}
        filter="blur(48px)"
      />

      <Box position="relative" zIndex={1} px={{ base: "18px", md: "28px", xl: "40px" }} py={{ base: "18px", md: "24px" }}>
        <Flex align="center" justify="space-between" gap="12px" mb={{ base: "18px", md: "24px" }} wrap="wrap">
          <Flex align="center" gap="10px">
            <Box
              w="10px"
              h="10px"
              borderRadius="50%"
              bg={drop.state === "live" || drop.state === "partially_sold" ? G : "whiteAlpha.500"}
              boxShadow={drop.state === "live" || drop.state === "partially_sold" ? "0 0 0 8px rgba(0,213,75,0.16)" : "none"}
            />
            <Text fontFamily={FONT} fontSize="12px" fontWeight="700" color="whiteAlpha.700" textTransform="uppercase" letterSpacing="0.16em">
              FlashDrop Live Wall
            </Text>
          </Flex>

          <Flex align="center" gap="10px" wrap="wrap">
            <Box
              as="button"
              border="1px solid rgba(255,255,255,0.14)"
              borderRadius="999px"
              px="14px"
              h="38px"
              display="flex"
              alignItems="center"
              fontFamily={FONT}
              fontSize="13px"
              fontWeight="600"
              bg="rgba(255,255,255,0.06)"
              color="white"
              cursor="pointer"
              onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
            >
              Open buyer checkout
            </Box>
            <Box
              as="button"
              border="1px solid rgba(255,255,255,0.12)"
              borderRadius="999px"
              px="14px"
              h="38px"
              bg="rgba(255,255,255,0.04)"
              color="white"
              fontFamily={FONT}
              fontSize="13px"
              fontWeight="600"
              cursor="pointer"
              onClick={() => navigate("/dashboard")}
            >
              Exit wall
            </Box>
          </Flex>
        </Flex>

        <Grid templateColumns={{ base: "1fr", xl: "1.15fr 0.85fr" }} gap={{ base: "18px", xl: "22px" }}>
          <Box
            border="1px solid rgba(255,255,255,0.11)"
            borderRadius={{ base: "24px", md: "30px" }}
            overflow="hidden"
            bg="rgba(255,255,255,0.05)"
            boxShadow="0 28px 80px rgba(0,0,0,0.36)"
          >
            <Grid templateColumns={{ base: "1fr", lg: "0.92fr 1.08fr" }} minH={{ base: "auto", xl: "calc(100dvh - 140px)" }}>
              <Box minH={{ base: "280px", lg: "100%" }} position="relative" bg="#0a1219">
                <ProductTileImage imageUrl={drop.media_url ?? ""} title={drop.title} />
                <Box
                  position="absolute"
                  insetX={0}
                  bottom={0}
                  p={{ base: "18px", md: "24px" }}
                  bg="linear-gradient(180deg, rgba(5,10,14,0.02) 0%, rgba(5,10,14,0.84) 76%, rgba(5,10,14,0.98) 100%)"
                >
                  <Flex align="center" gap="10px" wrap="wrap">
                    <Box
                      px="12px"
                      py="6px"
                      borderRadius="999px"
                      bg={drop.state === "sold_out" ? "rgba(255,255,255,0.16)" : "rgba(0,213,75,0.18)"}
                      border="1px solid rgba(255,255,255,0.12)"
                    >
                      <Text fontFamily={FONT} fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">
                        {stateLabel}
                      </Text>
                    </Box>
                    <Text fontFamily={FONT} fontSize="12px" color="whiteAlpha.700">
                      One scan. One tap. One sale.
                    </Text>
                  </Flex>
                </Box>
              </Box>

              <Flex direction="column" p={{ base: "22px", md: "28px", xl: "34px" }}>
                <Text fontFamily={FONT} fontSize="12px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.16em">
                  Live storefront
                </Text>
                <Text fontFamily={FONT} fontSize={{ base: "34px", md: "50px", xl: "62px" }} lineHeight={0.95} fontWeight="700" letterSpacing="-2px" mt="12px">
                  {drop.title}
                </Text>
                <Text fontFamily={FONT} fontSize={{ base: "15px", md: "18px" }} lineHeight="1.65" color="whiteAlpha.800" mt="16px" maxW="40ch">
                  {drop.description || "Instant storefront energy for a physical drop. Show the wall, let the room scan, and watch inventory move live."}
                </Text>

                <SimpleGrid columns={{ base: 2, md: 3 }} gap="12px" mt={{ base: "24px", xl: "28px" }}>
                  {[
                    { label: "Price", value: `€ ${eurosFromCents(drop.price_cents)}` },
                    { label: "Remaining", value: String(Math.max(0, drop.inventory)) },
                    { label: "Sold", value: String(drop.sold_count) },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      borderRadius="18px"
                      p={{ base: "16px", md: "18px" }}
                      bg="rgba(255,255,255,0.06)"
                      border="1px solid rgba(255,255,255,0.09)"
                    >
                      <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.08em">
                        {item.label}
                      </Text>
                      <Text fontFamily={FONT} fontSize={{ base: "24px", md: "28px" }} fontWeight="700" letterSpacing="-0.8px" mt="10px">
                        {item.value}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>

                <Box
                  mt={{ base: "18px", md: "22px" }}
                  p={{ base: "18px", md: "20px" }}
                  borderRadius="22px"
                  bg="linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))"
                  border="1px solid rgba(255,255,255,0.10)"
                >
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.08em">
                    Seller script
                  </Text>
                  <Text fontFamily={FONT} fontSize={{ base: "18px", md: "22px" }} fontWeight="600" lineHeight="1.45" mt="10px">
                    "Scan the code, pay on your phone, and this wall updates the second it lands."
                  </Text>
                </Box>

                <Flex mt="auto" pt={{ base: "22px", md: "28px" }} gap="10px" wrap="wrap">
                  {["Point", "Speak", "Publish", "Sell"].map((step, index) => (
                    <Flex
                      key={step}
                      align="center"
                      gap="10px"
                      px="14px"
                      h="42px"
                      borderRadius="999px"
                      bg="rgba(255,255,255,0.06)"
                      border="1px solid rgba(255,255,255,0.08)"
                    >
                      <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="whiteAlpha.600">
                        0{index + 1}
                      </Text>
                      <Text fontFamily={FONT} fontSize="13px" fontWeight="600">
                        {step}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </Grid>
          </Box>

          <Flex direction="column" gap="18px">
            <Box
              borderRadius={{ base: "24px", md: "28px" }}
              p={{ base: "22px", md: "26px" }}
              bg="rgba(255,255,255,0.06)"
              border="1px solid rgba(255,255,255,0.10)"
              boxShadow="0 28px 80px rgba(0,0,0,0.24)"
            >
              <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.12em">
                {ctaLabel}
              </Text>
              <Text fontFamily={FONT} fontSize={{ base: "18px", md: "22px" }} fontWeight="600" lineHeight="1.4" mt="10px" mb="18px">
                This is the projected seller mode. Keep it on a screen and let buyers self-serve the checkout.
              </Text>

              <Flex align="center" justify="center" p={{ base: "18px", md: "22px" }} bg="white" borderRadius="28px">
                <QrCode.Root value={checkoutUrl} color="#0f1720" bg="white" maxW={{ base: "250px", md: "320px" }} w="full">
                  <QrCode.Frame>
                    <QrCode.Pattern />
                  </QrCode.Frame>
                </QrCode.Root>
              </Flex>

              <Text fontFamily={FONT} fontSize="13px" color="whiteAlpha.700" mt="18px" lineHeight="1.6">
                Buyers land on the mobile checkout instantly. The wall stays clean, the phone handles payment, and the seller screen becomes the show.
              </Text>

              <Flex gap="10px" mt="18px" wrap="wrap">
                <Box
                  as="button"
                  bg={G}
                  color="black"
                  borderRadius="999px"
                  px="16px"
                  h="42px"
                  display="flex"
                  alignItems="center"
                  fontFamily={FONT}
                  fontSize="13px"
                  fontWeight="700"
                  cursor="pointer"
                  border="none"
                  onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
                >
                  Test buyer flow
                </Box>
                {drop.bunq_tab_url && (
                  <Box
                    as="button"
                    border="1px solid rgba(255,255,255,0.12)"
                    borderRadius="999px"
                    px="16px"
                    h="42px"
                    display="flex"
                    alignItems="center"
                    fontFamily={FONT}
                    fontSize="13px"
                    fontWeight="600"
                    bg="rgba(255,255,255,0.04)"
                    color="white"
                    cursor="pointer"
                    onClick={() => window.open(drop.bunq_tab_url ?? "", "_blank", "noopener,noreferrer")}
                  >
                    View bunq link
                  </Box>
                )}
              </Flex>
            </Box>

            <Box
              borderRadius={{ base: "24px", md: "28px" }}
              p={{ base: "22px", md: "24px" }}
              bg="rgba(255,255,255,0.05)"
              border="1px solid rgba(255,255,255,0.10)"
            >
              <Flex align="center" justify="space-between" gap="12px" mb="16px">
                <Box>
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="0.12em">
                    Live activity
                  </Text>
                  <Text fontFamily={FONT} fontSize="14px" color="whiteAlpha.700" mt="4px">
                    Instant sale feed for the room.
                  </Text>
                </Box>
                <Text fontFamily={FONT} fontSize="13px" fontWeight="600" color={drop.state === "sold_out" ? "whiteAlpha.900" : "green.300"}>
                  {stateLabel}
                </Text>
              </Flex>

              <Flex direction="column" gap="12px">
                {activity.map((item) => (
                  <Flex
                    key={item.id}
                    align="start"
                    gap="12px"
                    p="14px"
                    borderRadius="18px"
                    bg={item.tone === "sale" ? "rgba(0,213,75,0.12)" : "rgba(255,255,255,0.05)"}
                    border="1px solid"
                    borderColor={item.tone === "sale" ? "rgba(0,213,75,0.16)" : "rgba(255,255,255,0.08)"}
                  >
                    <Box
                      w="10px"
                      h="10px"
                      mt="6px"
                      borderRadius="50%"
                      bg={item.tone === "sale" ? G : item.tone === "state" ? "#f6ad55" : "whiteAlpha.700"}
                      flexShrink={0}
                    />
                    <Box flex={1}>
                      <Text fontFamily={FONT} fontSize="14px" fontWeight="600" lineHeight="1.5">
                        {item.text}
                      </Text>
                      <Text fontFamily={FONT} fontSize="12px" color="whiteAlpha.600" mt="4px">
                        {item.time}
                      </Text>
                    </Box>
                  </Flex>
                ))}
              </Flex>
            </Box>
          </Flex>
        </Grid>
      </Box>

      {celebration && <PaymentCelebration data={celebration} onDone={() => setCelebration(null)} />}
    </Box>
  );
}

function BuyerCheckoutPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<DropDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.getDrop(slug)
      .then((result) => { if (active) setDrop(result); })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load checkout");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const handlePay = async () => {
    if (!drop) return;
    setPaying(true);
    setError("");
    try {
      await api.mockPayment(drop.id);
      navigate(`/buy/${encodeURIComponent(drop.slug)}/success`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setPaying(false);
    }
  };

  if (loading) {
    return <Flex minH="100dvh" bg={BG} align="center" justify="center"><Spinner size="xl" /></Flex>;
  }

  if (!drop) {
    return (
      <Flex minH="100dvh" bg={BG} align="center" justify="center" p={6}>
        <Box className="glass-card" borderRadius="18px" p="28px" maxW="420px" w="full">
          <Text fontFamily={FONT} fontSize="22px" fontWeight="700" color={TEXT}>Checkout unavailable</Text>
          <Text fontFamily={FONT} fontSize="14px" color={MUTED} mt="8px">
            {error || "This payment page could not be loaded."}
          </Text>
        </Box>
      </Flex>
    );
  }

  const checkoutState = checkoutStatusFromState(drop.state);

  return (
    <Flex minH="100dvh" bg={BG} align="center" justify="center" p={{ base: 4, md: 8 }}>
      <Box className="glass-card" borderRadius="22px" maxW="460px" w="full" overflow="hidden">
        <Box h="220px" overflow="hidden" bg={SURFACE}>
          <ProductTileImage imageUrl={drop.media_url ?? ""} title={drop.title} />
        </Box>
        <Box p={{ base: "22px", md: "28px" }}>
          <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.08em">
            FlashDrop checkout
          </Text>
          <Text fontFamily={FONT} fontSize="28px" fontWeight="700" color={TEXT} letterSpacing="-0.9px" mt="6px">
            {drop.title}
          </Text>
          <Text fontFamily={FONT} fontSize="15px" color={MUTED} lineHeight="1.55" mt="10px">
            {drop.description || "Complete the sandbox buyer flow below."}
          </Text>

          <Flex align="baseline" justify="space-between" mt="20px" mb="18px">
            <Text fontFamily={FONT} fontSize="30px" fontWeight="700" color={TEXT} letterSpacing="-0.7px">
              € {eurosFromCents(drop.price_cents)}
            </Text>
            <Text fontFamily={FONT} fontSize="12px" color={MUTED}>
              {Math.max(0, drop.inventory)} left
            </Text>
          </Flex>

          <Box
            bg={SURFACE}
            border="1px solid"
            borderColor={BORDER}
            borderRadius="14px"
            p="14px"
            mb="16px"
          >
            <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em">
              Sandbox note
            </Text>
            <Text fontFamily={FONT} fontSize="13px" color={TEXT} mt="6px" lineHeight="1.55">
              This buyer page mimics the QR scan to pay to redirect flow. Tapping pay triggers the mocked bunq callback so the seller dashboard updates live.
            </Text>
          </Box>

          {error && (
            <Text fontFamily={FONT} fontSize="13px" color="red.500" mb="12px">{error}</Text>
          )}

          <Box
            as="button"
            {...btnPrimary}
            w="full"
            h="50px"
            opacity={paying || checkoutState !== "ready" ? 0.6 : 1}
            cursor={paying || checkoutState !== "ready" ? "not-allowed" : "pointer"}
            onClick={paying || checkoutState !== "ready" ? undefined : handlePay}
          >
            {checkoutState === "paid" ? "Already paid" : checkoutState === "unavailable" ? "Unavailable" : paying ? "Processing payment…" : "Pay now"}
          </Box>

          <Box mt="14px">
            <Text fontFamily={FONT} fontSize="10px" color={MUTED} textTransform="uppercase" letterSpacing="0.06em">
              bunq integration proof
            </Text>
            <Text fontFamily={FONT} fontSize="12px" color={MUTED} mt="6px" lineHeight="1.55">
              We still create the real bunq sandbox payment link. It is surfaced below even though the sandbox buyer page itself is currently unreliable.
            </Text>
            {drop.bunq_tab_url && (
              <Link
                href={drop.bunq_tab_url}
                target="_blank"
                rel="noreferrer"
                display="inline-block"
                mt="8px"
                fontFamily={FONT}
                fontSize="12px"
                color={TEXT}
                textDecoration="underline"
                textUnderlineOffset="2px"
                wordBreak="break-all"
              >
                {drop.bunq_tab_url}
              </Link>
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}

function BuyerSuccessPage() {
  const { slug = "" } = useParams();
  const [drop, setDrop] = useState<DropDetail | null>(null);

  useEffect(() => {
    api.getDrop(slug).then(setDrop).catch(() => undefined);
  }, [slug]);

  return (
    <Flex minH="100dvh" bg={BG} align="center" justify="center" p={{ base: 4, md: 8 }}>
      <Box className="glass-card" borderRadius="22px" maxW="420px" w="full" p={{ base: "28px", md: "34px" }}>
        <Box
          w="64px" h="64px"
          bg="black"
          borderRadius="50%"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb="18px"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
        <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.08em">
          Payment complete
        </Text>
        <Text fontFamily={FONT} fontSize="30px" fontWeight="700" color={TEXT} letterSpacing="-0.9px" mt="8px">
          Thanks for your payment
        </Text>
        <Text fontFamily={FONT} fontSize="15px" color={MUTED} lineHeight="1.6" mt="12px">
          {drop ? `${drop.title} was marked as paid and the seller view should now be updated.` : "The seller dashboard should now reflect the payment."}
        </Text>
        {drop && (
          <Text fontFamily={FONT} fontSize="22px" fontWeight="700" color={TEXT} mt="20px">
            € {eurosFromCents(drop.price_cents)}
          </Text>
        )}
      </Box>
    </Flex>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wall/:slug" element={<LiveWallPage />} />
        <Route path="/buy/:slug" element={<BuyerCheckoutPage />} />
        <Route path="/buy/:slug/success" element={<BuyerSuccessPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
