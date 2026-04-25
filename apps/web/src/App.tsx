import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Box, Flex, Grid, Image, SimpleGrid, Spinner, Text, Textarea } from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, centsFromEuros, dataUrlToBlob, eurosFromCents, type DropPublic } from "./api";
import { G, DARK, INK_FG, BG, SURFACE, CARD, BORDER, TEXT, MUTED, FONT, PANEL } from "./theme/tokens";
import { BunqWordmark } from "./components/BunqWordmark";
import { BunqQrPanel } from "./components/BunqQrPanel";
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
const SELLER_KEY  = "flashdrop_seller_id";
const getSellerId = () => sessionStorage.getItem(SELLER_KEY) ?? "";
const setSellerId = (v: string) => sessionStorage.setItem(SELLER_KEY, v);

function dropToListing(drop: DropPublic): Listing {
  const status =
    drop.state === "live" || drop.state === "partially_sold" ? "live" as const
    : drop.state === "sold_out" ? "sold" as const
    : "draft" as const;
  return {
    id: drop.id, slug: drop.slug, title: drop.title,
    description: drop.description ?? "", price: eurosFromCents(drop.price_cents),
    stock: drop.inventory - drop.sold_count, category: "FlashDrop",
    imageUrl: drop.media_url ?? "", prompt: "", status,
    createdAt: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(drop.created_at)),
    bunqTabUrl: drop.bunq_tab_url,
  };
}

function nowTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
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

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(getSellerId);
  const { dark, toggle } = useTheme();

  const go = () => {
    setSellerId(name.trim() || "demo-seller");
    navigate("/dashboard");
  };

  return (
    <Grid
      minH="100dvh"
      templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
    >
      {/* Left: form */}
      <Flex
        direction="column"
        justify="center"
        p={{ base: "40px 24px", md: "60px 80px" }}
        bg={BG}
        position="relative"
      >
        {/* Theme toggle top-right of left panel */}
        <Box position="absolute" top="20px" right="20px">
          <ThemeToggle dark={dark} toggle={toggle} />
        </Box>

        <Box mb="48px">
          <BunqWordmark subtitle="FlashDrop" />
        </Box>

        <Box mb="32px">
          <Text
            fontFamily={FONT}
            fontSize={{ base: "32px", md: "40px" }}
            fontWeight="700"
            color={TEXT}
            letterSpacing="-1px"
            lineHeight={1.15}
            mb="12px"
          >
            Sell anything, right now.
          </Text>
          <Text fontFamily={FONT} fontSize="16px" color={MUTED} lineHeight={1.6}>
            Snap a photo, say your pitch, get a live bunq payment link in seconds.
          </Text>
        </Box>

        <Box display="flex" flexDirection="column" gap="12px" maxW="400px">
          <Box>
            <Text fontFamily={FONT} fontSize="12px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">
              Seller name
            </Text>
            <Box
              as="input"
              {...inputBase as any}
              placeholder="e.g. Sarah, Booth 12"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && go()}
            />
          </Box>

          <Box
            as="button"
            {...btnPrimary}
            h="48px"
            gap="8px"
            onClick={go}
            mt="4px"
          >
            Start selling <IconArrow />
          </Box>

          <Box
            as="button"
            {...btnOutline}
            h="44px"
            onClick={() => { setSellerId("demo-seller"); navigate("/dashboard"); }}
          >
            View demo
          </Box>
        </Box>

        <Flex gap="24px" mt="48px" flexWrap="wrap">
          {["Camera-first", "Voice pitch", "AI listing copy", "bunq payment QR"].map((f) => (
            <Flex key={f} align="center" gap="6px">
              <Box w="5px" h="5px" borderRadius="50%" bg={MUTED} flexShrink={0} />
              <Text fontFamily={FONT} fontSize="13px" color={MUTED}>{f}</Text>
            </Flex>
          ))}
        </Flex>
      </Flex>

      {/* Right: always-dark branded panel */}
      <Flex
        display={{ base: "none", lg: "flex" }}
        bg={PANEL}
        direction="column"
        justify="center"
        align="center"
        p="60px"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute" inset={0} opacity={0.04}
          backgroundImage="linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)"
          backgroundSize="48px 48px"
        />

        {/* Mock product card — always white regardless of theme */}
        <Box
          position="relative" zIndex={1}
          bg="white" borderRadius="16px"
          w="full" maxW="360px"
          boxShadow="0 40px 80px rgba(0,0,0,0.5)"
          overflow="hidden"
        >
          <Box position="relative">
            <ProductTileImage title="Campus Tote" />
            <Flex
              position="absolute" top="10px" right="10px"
              align="center" gap="5px"
              bg="white" borderRadius="20px" px="8px" py="4px"
            >
              <Box bg={G} borderRadius="full" h="7px" w="7px" className="live-pulse" position="relative" />
              <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="black">Live</Text>
            </Flex>
          </Box>
          <Box p="16px">
            <Flex justify="space-between" align="baseline" mb="4px">
              <Text fontFamily={FONT} fontSize="15px" fontWeight="600" color="#0a0a0a">Campus Tote</Text>
              <Text fontFamily={FONT} fontSize="15px" fontWeight="700" color="#0a0a0a">€ 12.00</Text>
            </Flex>
            <Text fontFamily={FONT} fontSize="13px" color="#667085" mb="12px">Hand-painted, 4 left at the booth.</Text>
            <BunqQrPanel url="bunq.me/flashdrop/campus-tote" price="12.00" />
          </Box>
        </Box>
      </Flex>
    </Grid>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardPage() {
  const navigate                   = useNavigate();
  const sellerId                   = getSellerId();
  const { dark, toggle }           = useTheme();
  const [listings, setListings]    = useState<Listing[]>([]);
  const [loading, setLoading]      = useState(true);
  const [loadError, setLoadError]  = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editTarget, setEditTarget]   = useState<Listing | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const liveCount  = listings.filter((l) => l.status === "live").length;
  const stockCount = listings.reduce((t, l) => t + l.stock, 0);
  const soldCount  = listings.filter((l) => l.status === "sold").length;

  const fetchDrops = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const drops = await api.listDrops({ seller_id: sellerId || undefined, limit: 100 });
      setListings(drops.map(dropToListing));
    } catch {
      setLoadError("Could not reach backend.");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { fetchDrops(); }, [fetchDrops]);

  const updateListing = useCallback((id: string, u: Partial<Listing>) => {
    setListings((cur) => cur.map((l) => l.id === id ? { ...l, ...u } : l));
  }, []);

  return (
    <Box bg={BG} minH="100dvh" pb="120px">
      {/* Nav */}
      <Box
        bg={CARD}
        borderBottom="1px solid"
        borderColor={BORDER}
        px={{ base: "16px", md: "40px" }}
        h="56px"
        display="flex"
        alignItems="center"
      >
        <Flex align="center" justify="space-between" w="full" maxW="1200px" mx="auto">
          <Flex align="center" gap="16px" minW={0}>
            <BunqWordmark subtitle="FlashDrop" />
            {sellerId && (
              <Box
                display={{ base: "none", sm: "block" }}
                h="20px" w="1px" bg={BORDER} flexShrink={0}
              />
            )}
            {sellerId && (
              <Text
                display={{ base: "none", sm: "block" }}
                fontFamily={FONT} fontSize="13px" color={MUTED}
                overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
                maxW="160px"
              >
                {sellerId}
              </Text>
            )}
          </Flex>

          <Flex align="center" gap="8px" flexShrink={0}>
            <Flex
              display={{ base: "none", md: "flex" }}
              align="center" gap="6px"
              px="10px" h="28px"
              bg={SURFACE}
              border="1px solid"
              borderColor={BORDER}
              borderRadius="20px"
            >
              <Box bg={G} borderRadius="full" h="6px" w="6px" flexShrink={0} />
              <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color={MUTED}>bunq connected</Text>
            </Flex>

            <ThemeToggle dark={dark} toggle={toggle} />

            <Box
              as="button"
              {...btnOutline}
              h="32px"
              px="12px"
              fontSize="12px"
              onClick={() => navigate("/")}
            >
              <Text display={{ base: "none", sm: "inline" }}>Switch seller</Text>
              <Text display={{ base: "inline", sm: "none" }}>Exit</Text>
            </Box>
          </Flex>
        </Flex>
      </Box>

      {/* Page body */}
      <Box maxW="1200px" mx="auto" px={{ base: "16px", md: "40px" }} py={{ base: "24px", md: "32px" }}>

        {/* Stats */}
        <SimpleGrid columns={3} gap={{ base: "10px", md: "16px" }} mb={{ base: "24px", md: "32px" }}>
          {[
            { label: "Live drops", value: liveCount },
            { label: "In stock",   value: stockCount },
            { label: "Sold out",   value: soldCount },
          ].map(({ label, value }) => (
            <Box
              key={label}
              bg={CARD}
              border="1px solid"
              borderColor={BORDER}
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
            </Box>
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
          <Box
            bg={CARD} border="1px solid" borderColor={BORDER}
            borderRadius="12px" p="64px 24px" textAlign="center"
          >
            <Text fontFamily={FONT} fontSize="16px" fontWeight="600" color={TEXT} mb="6px">No listings yet</Text>
            <Text fontFamily={FONT} fontSize="14px" color={MUTED}>Tap the button below to create your first drop.</Text>
          </Box>
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
          w="56px" h="56px"
          bg={DARK}
          borderRadius="50%"
          color={INK_FG}
          border="none"
          cursor="pointer"
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="auto"
          boxShadow="0 8px 24px rgba(0,0,0,0.28)"
          transition="transform 180ms ease, box-shadow 180ms ease"
          _hover={{ transform: "scale(1.08)", boxShadow: "0 12px 32px rgba(0,0,0,0.36)" }}
          onClick={() => setCaptureOpen(true)}
        >
          <IconCamera />
        </Box>
      </Box>

      {captureOpen && (
        <CaptureOverlay
          sellerId={sellerId}
          onClose={() => setCaptureOpen(false)}
          onPost={(l) => setListings((cur) => [l, ...cur])}
        />
      )}
      {editTarget && (
        <EditModal
          listing={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(u) => { updateListing(editTarget.id, u); setEditTarget(null); }}
        />
      )}
      {celebration && <PaymentCelebration data={celebration} onDone={() => setCelebration(null)} />}
    </Box>
  );
}

// ─── Capture overlay ──────────────────────────────────────────────────────────
type CaptureProps = { sellerId: string; onClose: () => void; onPost: (l: Listing) => void };

function CaptureOverlay({ sellerId, onClose, onPost }: CaptureProps) {
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

  const hasPhoto    = Boolean(draft.imageUrl);
  const canGenerate = hasPhoto || draft.prompt.trim().length > 0;

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
    setRecording(true); audioChunksRef.current = [];
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.continuous = true; r.interimResults = true;
      r.onresult = (ev: any) => {
        const t = Array.from(ev.results as any[]).map((x: any) => x[0]?.transcript ?? "").join(" ").trim();
        if (t) setDraft((d) => ({ ...d, prompt: t }));
      };
      r.start(); recognitionRef.current = r;
    }
    try {
      const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setDraft((d) => ({ ...d, audioUrl: blob.size > 0 ? URL.createObjectURL(blob) : d.audioUrl }));
      };
      rec.start(); recorderRef.current = rec;
    } catch { /* mic unavailable */ }
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
      const created  = await api.createDrop({ title: draft.title.trim() || titleFromPrompt(draft.prompt), description: draft.description.trim(), pitch: draft.prompt.trim() || null, price_cents: centsFromEuros(draft.price), inventory: Math.max(1, draft.stock), media_url: mediaUrl, seller_id: sellerId || undefined });
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
        border={{ base: "none", md: "1px solid" }}
        borderColor={BORDER}
        borderRadius={{ base: "0", md: "16px" }}
        w="full"
        maxW="1040px"
        maxH={{ base: "100dvh", md: "calc(100dvh - 48px)" }}
        overflow="auto"
        boxShadow={{ md: "0 32px 64px rgba(0,0,0,0.24)" }}
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
          bg={CARD}
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
              {isPosting ? <Spinner size="xs" /> : null}
              {isPosting ? "Publishing…" : "Publish to bunq"}
              {!isPosting && <IconArrow />}
            </Box>
          </Box>
        </Grid>
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
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
