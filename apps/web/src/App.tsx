import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, centsFromEuros, dataUrlToBlob, eurosFromCents, type DropPublic } from "./api";
import { BUNQ_GREEN, BUNQ_DARK, CREAM } from "./theme/tokens";
import { CameraIcon, MicIcon, SparkIcon } from "./components/icons";
import { BunqWordmark } from "./components/BunqWordmark";
import { BunqQrPanel } from "./components/BunqQrPanel";
import { ProductTileImage } from "./components/ProductTileImage";
import { VoiceWave } from "./components/VoiceWave";
import { PaymentCelebration, type CelebrationData } from "./components/PaymentCelebration";
import { ListingCard, type Listing } from "./components/ListingCard";
import { EditModal } from "./components/EditModal";

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
    id: drop.id,
    slug: drop.slug,
    title: drop.title,
    description: drop.description ?? "",
    price: eurosFromCents(drop.price_cents),
    stock: drop.inventory - drop.sold_count,
    category: "FlashDrop",
    imageUrl: drop.media_url ?? "",
    prompt: "",
    status,
    createdAt: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(drop.created_at)),
    bunqTabUrl: drop.bunq_tab_url,
  };
}

function nowTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function titleFromPrompt(prompt: string) {
  const words = prompt.trim().replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "Fresh FlashDrop";
}

function makeLocalDraft(draft: DraftListing): DraftListing {
  const p = draft.prompt.toLowerCase();
  return {
    ...draft,
    title: draft.title || titleFromPrompt(draft.prompt),
    description: draft.description || `${draft.prompt} — limited drop, ready now.`,
    price: p.includes("jacket") || p.includes("vintage") ? "34.00" : p.includes("cookie") ? "8.50" : draft.price || "12.00",
    stock: draft.stock || 1,
  };
}

type DraftListing = {
  imageUrl: string;
  prompt: string;
  title: string;
  description: string;
  price: string;
  stock: number;
  category: string;
  audioUrl?: string;
};

const emptyDraft: DraftListing = {
  imageUrl: "", prompt: "", title: "", description: "", price: "12.00", stock: 1, category: "Quick drop",
};

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(getSellerId);

  const go = () => { setSellerId(name.trim() || "demo-seller"); navigate("/dashboard"); };

  return (
    <Grid
      alignItems="center"
      bg={CREAM}
      minH="100dvh"
      overflow="hidden"
      p={{ base: 4, md: 8 }}
      templateColumns={{ base: "1fr", lg: "1fr 0.9fr" }}
    >
      {/* Hero card */}
      <Box
        bg={BUNQ_DARK}
        borderRadius="32px"
        color="white"
        minH={{ base: "auto", lg: "calc(100dvh - 64px)" }}
        p={{ base: 6, md: 12 }}
      >
        <Box mb={8}>
          <BunqWordmark subtitle="FlashDrop" />
        </Box>

        <Heading letterSpacing="-1px" maxW="680px" size={{ base: "4xl", md: "6xl" }} lineHeight={1.1}>
          Snap it, speak it,{" "}
          <Text as="span" color={BUNQ_GREEN}>sell it now.</Text>
        </Heading>
        <Text color="whiteAlpha.700" fontSize={{ base: "lg", md: "xl" }} mt={6} maxW="560px">
          Camera-first marketplace — product to bunq payment link in under 30 seconds.
        </Text>

        <Stack gap={3} mt={10} maxW="360px">
          <Input
            bg="whiteAlpha.100"
            border="1.5px solid"
            borderColor="whiteAlpha.200"
            borderRadius="14px"
            color="white"
            fontSize="lg"
            h="52px"
            placeholder="Your seller name"
            _placeholder={{ color: "whiteAlpha.400" }}
            _focus={{ borderColor: BUNQ_GREEN }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
          <HStack gap={3}>
            <Button
              bg={BUNQ_GREEN} color="black" fontWeight="bold"
              onClick={go} size="lg" flex={1} borderRadius="14px" h="52px"
              _hover={{ bg: "#00c044" }}
            >
              Start selling
            </Button>
            <Button
              colorPalette="gray" variant="surface"
              onClick={() => { setSellerId("demo-seller"); navigate("/dashboard"); }}
              size="lg" flex={1} borderRadius="14px" h="52px"
            >
              Demo
            </Button>
          </HStack>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={12}>
          {[
            ["📸 Camera first", "Your item is the UI."],
            ["🎙 Voice pitch", "Speak your sales angle."],
            ["⚡ AI listing", "Copy in seconds."],
          ].map(([title, body]) => (
            <Box
              bg="whiteAlpha.100"
              borderRadius="18px"
              key={title as string}
              p={5}
              borderTop={`3px solid ${BUNQ_GREEN}`}
            >
              <Text fontWeight="black">{title}</Text>
              <Text color="whiteAlpha.600" mt={2} fontSize="sm">{body}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      {/* Mockup preview */}
      <Flex align="center" justify="center" minH={{ base: "400px", lg: "auto" }} p={{ base: 0, md: 8 }}>
        <Box maxW="400px" w="full">
          <Box bg="white" borderRadius="32px" boxShadow="0 40px 80px rgba(0,0,0,0.18)" p={4}>
            <Flex align="center" justify="space-between" mb={4}>
              <HStack gap={2}>
                <Box bg={BUNQ_GREEN} borderRadius="full" h="11px" w="11px" />
                <Box bg="#facc15" borderRadius="full" h="11px" w="11px" />
                <Box bg="#f87171" borderRadius="full" h="11px" w="11px" />
              </HStack>
              <Badge bg={BUNQ_GREEN} color="black" borderRadius="8px" px={2} fontWeight="bold" fontSize="xs">live</Badge>
            </Flex>
            <ProductTileImage title="Campus Tote" />
            <Box mt={4}>
              <Heading size="lg">Campus Tote</Heading>
              <Text color="gray.500" mt={1} fontSize="sm">Student-made, 4 left at the booth.</Text>
            </Box>
            <Box mt={4}>
              <BunqQrPanel url="bunq.me/flashdrop/campus-tote" price="12.00" />
            </Box>
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
    setLoading(true);
    setLoadError("");
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
    <Box bg={CREAM} minH="100dvh" pb="120px">
      {/* Top nav */}
      <Box bg={BUNQ_DARK} color="white" px={{ base: 5, md: 10 }} py={5}>
        <Flex align="center" justify="space-between" maxW="1180px" mx="auto">
          <HStack gap={3}>
            <BunqWordmark subtitle="FlashDrop" />
            {sellerId && (
              <Badge bg="whiteAlpha.200" color="whiteAlpha.700" borderRadius="8px" px={2} fontWeight="medium">
                {sellerId}
              </Badge>
            )}
          </HStack>
          <HStack gap={3}>
            <Badge bg={BUNQ_GREEN} color="black" borderRadius="8px" px={2} fontWeight="bold" fontSize="xs">
              bunq connected
            </Badge>
            <Button size="xs" variant="ghost" color="whiteAlpha.500" onClick={() => navigate("/")} _hover={{ color: "white" }}>
              Switch seller
            </Button>
          </HStack>
        </Flex>
      </Box>

      <Box maxW="1180px" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 5, md: 8 }}>
        {/* Stats */}
        <SimpleGrid columns={3} gap={4} mb={8}>
          {[
            { label: "Live", value: liveCount, bg: BUNQ_GREEN, color: "black" },
            { label: "In stock", value: stockCount, bg: "#f0fdf4", color: "#166534" },
            { label: "Sold", value: soldCount, bg: "#fef9ec", color: "#92400e" },
          ].map(({ label, value, bg, color }) => (
            <Card.Root bg="white" borderRadius="20px" key={label} boxShadow="0 4px 16px rgba(0,0,0,0.05)">
              <Card.Body p={5}>
                <Text color="gray.400" fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.05em">{label}</Text>
                <Box bg={bg} display="inline-block" borderRadius="10px" mt={2} px={3} py={1}>
                  <Heading color={color} size="2xl">{value}</Heading>
                </Box>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>

        {/* Listings header */}
        <Flex align="center" justify="space-between" mb={5}>
          <Box>
            <Heading size="lg" color={BUNQ_DARK}>Your drops</Heading>
            <Text color="gray.400" fontSize="sm" mt={1}>
              {loading ? "Loading…" : loadError || `${listings.length} listings`}
            </Text>
          </Box>
          <Button borderRadius="12px" variant="outline" onClick={fetchDrops} loading={loading} size="sm">
            Refresh
          </Button>
        </Flex>

        {loading ? (
          <Flex justify="center" py={20}><Spinner size="xl" color={BUNQ_GREEN} /></Flex>
        ) : listings.length === 0 ? (
          <Card.Root bg="white" borderRadius="24px" boxShadow="0 4px 16px rgba(0,0,0,0.05)">
            <Card.Body p={12} textAlign="center">
              <Text fontSize="48px">📸</Text>
              <Heading size="lg" mt={3} color={BUNQ_DARK}>No listings yet</Heading>
              <Text color="gray.400" mt={2}>Tap the camera button to snap your first drop.</Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={5}>
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                onUpdate={(u) => updateListing(l.id, u)}
                onEdit={() => setEditTarget(l)}
                onCelebrate={setCelebration}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* Camera FAB */}
      <Flex bottom="28px" justify="center" left={0} pointerEvents="none" position="fixed" right={0} zIndex={20}>
        <Button
          aria-label="New drop"
          bg={BUNQ_GREEN}
          border="5px solid"
          borderColor={CREAM}
          borderRadius="full"
          boxShadow="0 12px 40px rgba(0,213,75,0.45)"
          color="black"
          h="84px"
          onClick={() => setCaptureOpen(true)}
          pointerEvents="auto"
          w="84px"
          _hover={{ bg: "#00c044", transform: "scale(1.06)" }}
          transition="all 180ms ease"
        >
          <CameraIcon />
        </Button>
      </Flex>

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
  const [stage, setStage]           = useState<"capture" | "review">("capture");

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
      .catch(() => setCameraErr("Camera blocked. Upload a photo instead."));
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
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setDraft((d) => ({ ...d, imageUrl: dataUrl }));
    canvas.toBlob((blob) => { capturedBlobRef.current = blob; remoteMediaRef.current = null; }, "image/jpeg", 0.92);
  };

  const retakePhoto = () => {
    setDraft((d) => ({ ...d, imageUrl: "" }));
    capturedBlobRef.current = null;
    remoteMediaRef.current  = null;
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    capturedBlobRef.current = file;
    remoteMediaRef.current  = null;
    setDraft((d) => ({ ...d, imageUrl: URL.createObjectURL(file) }));
    setUploading(true);
    try {
      const r = await api.uploadMedia(file, file.name);
      remoteMediaRef.current = r.url;
    } catch { /* retry on generate/post */ } finally { setUploading(false); }
  };

  const ensureUploaded = async (): Promise<string | null> => {
    if (remoteMediaRef.current) return remoteMediaRef.current;
    if (!capturedBlobRef.current) return null;
    const ext = capturedBlobRef.current.type.split("/")[1] ?? "jpg";
    const r = await api.uploadMedia(capturedBlobRef.current, `capture-${Date.now()}.${ext}`);
    remoteMediaRef.current = r.url;
    return r.url;
  };

  const startVoice = async () => {
    setRecording(true);
    audioChunksRef.current = [];
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev: SpeechRecognitionEventLike) => {
        const t = Array.from(ev.results).map((x) => x[0]?.transcript ?? "").join(" ").trim();
        if (t) setDraft((d) => ({ ...d, prompt: t }));
      };
      r.start();
      recognitionRef.current = r;
    }
    try {
      const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setDraft((d) => ({ ...d, audioUrl: blob.size > 0 ? URL.createObjectURL(blob) : d.audioUrl }));
      };
      rec.start();
      recorderRef.current = rec;
    } catch { /* mic unavailable */ }
  };

  const stopVoice = () => { recorderRef.current?.stop(); recognitionRef.current?.stop(); setRecording(false); };

  const generateListing = async () => {
    setGen(true); setApiError("");
    try {
      if (!capturedBlobRef.current && draft.imageUrl.startsWith("data:")) capturedBlobRef.current = await dataUrlToBlob(draft.imageUrl);
      const mediaUrl = await ensureUploaded();
      const pitch = draft.prompt.trim() || "Limited drop, ready to buy right now.";
      const preview = await api.generatePreview(pitch, mediaUrl);
      setDraft((d) => ({ ...d, title: preview.title, description: preview.description, price: eurosFromCents(preview.price_cents) }));
      setStage("review");
    } catch {
      setApiError("AI unreachable — using local preview.");
      setDraft((d) => makeLocalDraft(d));
      setStage("review");
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
    <Flex align="center" bg="blackAlpha.800" bottom={0} justify="center" left={0} p={{ base: 2, md: 5 }} position="fixed" right={0} top={0} zIndex={30}>
      <Card.Root borderRadius="28px" maxH="calc(100dvh - 24px)" maxW="1100px" overflow="auto" w="full">
        <Card.Body p={{ base: 4, md: 6 }}>
          {/* Header */}
          <Flex align="center" justify="space-between" mb={5}>
            <Box>
              <HStack gap={2} mb={2}>
                <BunqWordmark />
                <Badge
                  bg={stage === "capture" ? "#ffe4e6" : "#dcfce7"}
                  color={stage === "capture" ? "#be123c" : "#166534"}
                  borderRadius="8px" px={2} fontWeight="bold"
                >
                  {stage === "capture" ? "Capture" : "Review & publish"}
                </Badge>
              </HStack>
              <Heading size={{ base: "lg", md: "xl" }} color={BUNQ_DARK}>
                {stage === "capture" ? "Snap the item, pitch it" : "Review your listing"}
              </Heading>
            </Box>
            <Button colorPalette="gray" onClick={onClose} variant="ghost" borderRadius="12px">✕ Close</Button>
          </Flex>

          <Grid gap={5} templateColumns={{ base: "1fr", lg: "1fr 1fr" }}>
            {/* Left: camera */}
            <Stack gap={4}>
              <Box bg={BUNQ_DARK} borderRadius="24px" overflow="hidden" position="relative">
                {hasPhoto ? (
                  <Image alt="Captured" h={{ base: "340px", md: "480px" }} objectFit="cover" src={draft.imageUrl} w="full" />
                ) : (
                  <video
                    autoPlay muted playsInline ref={videoRef}
                    style={{ background: "#111", display: "block", height: "min(480px, 55vh)", objectFit: "cover", width: "100%" }}
                  />
                )}
                <HStack bottom="14px" left="14px" position="absolute" gap={2}>
                  <Badge
                    bg={cameraError ? "#fef2f2" : hasPhoto ? "#f0fdf4" : "#1a3a2a"}
                    color={cameraError ? "#991b1b" : hasPhoto ? "#166534" : BUNQ_GREEN}
                    borderRadius="8px" fontWeight="bold" fontSize="xs"
                  >
                    {cameraError ? `⚠ ${cameraError}` : hasPhoto ? (isUploading ? "⏫ Uploading…" : "✓ Photo ready") : "● Camera live"}
                  </Badge>
                </HStack>
              </Box>

              <HStack flexWrap="wrap" gap={3}>
                {!hasPhoto ? (
                  <Button bg={BUNQ_GREEN} color="black" fontWeight="bold" onClick={capturePhoto} borderRadius="12px" _hover={{ bg: "#00c044" }}>
                    📸 Capture
                  </Button>
                ) : (
                  <Button variant="outline" colorPalette="gray" onClick={retakePhoto} borderRadius="12px">
                    🔄 Retake
                  </Button>
                )}
                <Button as="label" colorPalette="gray" cursor="pointer" variant="outline" borderRadius="12px">
                  Upload photo
                  <Input accept="image/*,video/*" display="none" onChange={handleUpload} type="file" />
                </Button>
                <Button
                  border={isRecording ? "1.5px solid #ef4444" : undefined}
                  bg={isRecording ? "#fef2f2" : undefined}
                  color={isRecording ? "#dc2626" : undefined}
                  colorPalette={isRecording ? undefined : "gray"}
                  variant={isRecording ? "ghost" : "outline"}
                  borderRadius="12px"
                  onClick={isRecording ? stopVoice : startVoice}
                >
                  <MicIcon active={isRecording} />
                  {isRecording ? "Stop recording" : "Voice pitch"}
                </Button>
              </HStack>

              {/* Voice waveform */}
              <Box bg={isRecording ? "#f0fdf4" : "#f9fafb"} borderRadius="16px" p={4} transition="background 300ms ease">
                <VoiceWave active={isRecording} />
                {isRecording && (
                  <Text textAlign="center" fontSize="xs" color={BUNQ_GREEN} fontWeight="bold" mt={2}>
                    Recording your pitch…
                  </Text>
                )}
              </Box>
            </Stack>

            {/* Right: pitch + form */}
            <Stack gap={4}>
              <Card.Root bg="#f9fafb" borderRadius="20px" variant="outline">
                <Card.Body p={5}>
                  <HStack color={BUNQ_GREEN} mb={3} gap={2}>
                    <SparkIcon />
                    <Text fontWeight="black" color={BUNQ_DARK}>Pitch → AI listing</Text>
                  </HStack>
                  <Textarea
                    minH="120px"
                    borderRadius="12px"
                    placeholder="Type or say: what is it, why buy it, price vibes, stock count…"
                    value={draft.prompt}
                    onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                  />
                  {draft.audioUrl && (
                    <Box mt={3}>
                      <audio controls src={draft.audioUrl} style={{ width: "100%", borderRadius: "10px" }} />
                    </Box>
                  )}
                  <Button
                    bg={BUNQ_GREEN} color="black" fontWeight="bold" borderRadius="12px"
                    _hover={{ bg: "#00c044" }}
                    disabled={!canGenerate} loading={isGenerating}
                    mt={4} onClick={generateListing} w="full"
                  >
                    <SparkIcon /> Generate with AI
                  </Button>
                </Card.Body>
              </Card.Root>

              <Card.Root bg="white" borderRadius="20px" variant="outline">
                <Card.Body p={5}>
                  <Heading size="sm" mb={4} color={BUNQ_DARK}>Listing details</Heading>
                  <Stack gap={3}>
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Title</Text>
                      <Input borderRadius="12px" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                    </Box>
                    <SimpleGrid columns={2} gap={3}>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Price (EUR)</Text>
                        <Input borderRadius="12px" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                      </Box>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Stock</Text>
                        <Input type="number" min={0} borderRadius="12px" value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: Math.max(0, Number(e.target.value)) }))} />
                      </Box>
                    </SimpleGrid>
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Description</Text>
                      <Textarea borderRadius="12px" minH="100px" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                    </Box>
                  </Stack>
                  {apiError && <Text color="orange.600" fontSize="sm" mt={2}>{apiError}</Text>}
                  <Button
                    bg={BUNQ_GREEN} color="black" fontWeight="bold" borderRadius="14px"
                    _hover={{ bg: "#00c044" }}
                    disabled={!canGenerate} loading={isPosting}
                    mt={5} onClick={postListing} size="lg" w="full"
                    boxShadow="0 6px 24px rgba(0,213,75,0.35)"
                  >
                    🚀 Publish to bunq
                  </Button>
                </Card.Body>
              </Card.Root>
            </Stack>
          </Grid>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
}

// ─── Speech shims ─────────────────────────────────────────────────────────────
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; onresult: (e: SpeechRecognitionEventLike) => void; start: () => void; stop: () => void };

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
