import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  QrCode,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, centsFromEuros, dataUrlToBlob, eurosFromCents } from "./api";

type ListingStatus = "live" | "sold" | "draft";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: string;
  stock: number;
  category: string;
  imageUrl: string;
  prompt: string;
  status: ListingStatus;
  views: number;
  saves: number;
  createdAt: string;
  audioUrl?: string;
  slug?: string;
  bunqTabUrl?: string | null;
};

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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const starterListings: Listing[] = [
  {
    id: "campus-tote",
    title: "Campus Tote",
    description: "Hand-painted tote for laptops, sketchbooks, and all-day campus chaos.",
    price: "12.00",
    stock: 4,
    category: "Student makers",
    imageUrl: "",
    prompt: "Handmade tote, only 5 left. Support the design club before lunch.",
    status: "live",
    views: 318,
    saves: 41,
    createdAt: "09:41",
  },
  {
    id: "matcha-cookies",
    title: "Matcha Cookie Box",
    description: "Soft matcha cookies with white chocolate. Fresh batch, pickup at the booth.",
    price: "8.50",
    stock: 9,
    category: "Snack drop",
    imageUrl: "",
    prompt: "Matcha cookies, fresh this morning, limited box run.",
    status: "live",
    views: 204,
    saves: 29,
    createdAt: "09:26",
  },
  {
    id: "denim-jacket",
    title: "Y2K Denim Jacket",
    description: "Vintage cropped denim jacket with silver hardware and a clean oversized fit.",
    price: "34.00",
    stock: 1,
    category: "Thrift flip",
    imageUrl: "",
    prompt: "Cute denim jacket, thrifted, one of one, fits oversized.",
    status: "live",
    views: 542,
    saves: 88,
    createdAt: "08:58",
  },
];

const emptyDraft: DraftListing = {
  imageUrl: "",
  prompt: "",
  title: "",
  description: "",
  price: "12.00",
  stock: 1,
  category: "Quick drop",
};

function CameraIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="34" viewBox="0 0 24 24" width="34">
      <path
        d="M8.25 6.75 9.7 5h4.6l1.45 1.75H19A2.25 2.25 0 0 1 21.25 9v7A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V9A2.25 2.25 0 0 1 5 6.75h3.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MicIcon({ active = false }: { active?: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <path
        d="M12 14.25A3.25 3.25 0 0 0 15.25 11V6.5a3.25 3.25 0 0 0-6.5 0V11A3.25 3.25 0 0 0 12 14.25Z"
        stroke="currentColor"
        strokeWidth={active ? "2.4" : "1.8"}
      />
      <path
        d="M5.75 10.75a6.25 6.25 0 0 0 12.5 0M12 17v3.25M8.75 20.25h6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={active ? "2.4" : "1.8"}
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" fill="currentColor" />
      <path d="m18 15 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 15Z" fill="currentColor" />
    </svg>
  );
}

function formatPrice(price: string) {
  const parsed = Number(price);
  return `EUR ${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"}`;
}

function nowTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function createListingId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function titleFromPrompt(prompt: string) {
  const clean = prompt.trim().replace(/[.!?]+$/g, "");
  if (!clean) return "Fresh FlashDrop";

  const words = clean.split(/\s+/).filter(Boolean).slice(0, 4);
  return words.map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function makeAiDraft(draft: DraftListing): DraftListing {
  const prompt = draft.prompt.trim() || "Limited drop, ready to buy right now.";
  const lowerPrompt = prompt.toLowerCase();
  const price = lowerPrompt.includes("jacket") || lowerPrompt.includes("vintage")
    ? "34.00"
    : lowerPrompt.includes("cookie") || lowerPrompt.includes("coffee")
      ? "8.50"
      : draft.price || "12.00";
  const category = lowerPrompt.includes("thrift") || lowerPrompt.includes("vintage")
    ? "Thrift flip"
    : lowerPrompt.includes("cookie") || lowerPrompt.includes("coffee")
      ? "Snack drop"
      : "Quick drop";

  return {
    ...draft,
    title: draft.title || titleFromPrompt(prompt),
    description:
      draft.description ||
      `${prompt} AI polished this into a fast marketplace listing with scarcity, pickup energy, and a clean bunq checkout.`,
    price,
    stock: draft.stock || 1,
    category,
  };
}

function LoginPage() {
  const navigate = useNavigate();

  return (
    <Grid
      alignItems="center"
      bg="#f8f1df"
      minH="100dvh"
      overflow="hidden"
      p={{ base: 4, md: 8 }}
      position="relative"
      templateColumns={{ base: "1fr", lg: "1fr 0.9fr" }}
    >
      <Box
        bg="#111111"
        borderRadius="32px"
        color="white"
        minH={{ base: "auto", lg: "calc(100dvh - 64px)" }}
        p={{ base: 6, md: 12 }}
      >
        <Badge colorPalette="pink" mb={6}>
          Seller mode
        </Badge>
        <Heading letterSpacing="0" maxW="760px" size={{ base: "4xl", md: "6xl" }}>
          Snap it, speak it, sell it before the vibe disappears.
        </Heading>
        <Text color="whiteAlpha.800" fontSize={{ base: "lg", md: "xl" }} mt={6} maxW="620px">
          FlashDrop is a quick marketplace dashboard for sellers who want to turn a product in front
          of them into a live listing with camera, voice, AI copy, and bunq checkout.
        </Text>
        <HStack flexWrap="wrap" gap={3} mt={9}>
          <Button colorPalette="pink" onClick={() => navigate("/dashboard")} size="lg">
            Login
          </Button>
          <Button colorPalette="cyan" onClick={() => navigate("/dashboard")} size="lg" variant="surface">
            Try demo dashboard
          </Button>
        </HStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={10}>
          {[
            ["Camera first", "Your item is the UI."],
            ["Voice pitch", "Say the sales angle out loud."],
            ["AI listing", "Post-ready copy in seconds."],
          ].map(([title, body]) => (
            <Box bg="whiteAlpha.100" borderRadius="20px" key={title} p={5}>
              <Text fontWeight="black">{title}</Text>
              <Text color="whiteAlpha.700" mt={2}>
                {body}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Flex align="center" justify="center" minH={{ base: "420px", lg: "auto" }} p={{ base: 0, md: 8 }}>
        <Box maxW="420px" position="relative" w="full">
          <Box bg="#fcfcf7" borderRadius="34px" boxShadow="0 30px 80px rgba(18, 18, 18, 0.22)" p={4}>
            <Flex align="center" justify="space-between" mb={4}>
              <HStack>
                <Box bg="pink.400" borderRadius="full" h="12px" w="12px" />
                <Box bg="cyan.400" borderRadius="full" h="12px" w="12px" />
                <Box bg="lime.400" borderRadius="full" h="12px" w="12px" />
              </HStack>
              <Badge colorPalette="green">Live</Badge>
            </Flex>
            <ProductTileImage title="Campus Tote" />
            <Box mt={5}>
              <Heading size="lg">Campus Tote</Heading>
              <Text color="gray.600" mt={2}>
                AI-made listing, bunq QR ready, 4 left at the booth.
              </Text>
            </Box>
            <Flex bg="gray.950" borderRadius="22px" color="white" gap={4} mt={5} p={4}>
              <Qr value="bunq.me/flashdrop/campus-tote" />
              <Box>
                <Heading size="lg">EUR 12.00</Heading>
                <Text color="whiteAlpha.700">Scan to pay</Text>
              </Box>
            </Flex>
          </Box>
        </Box>
      </Flex>
    </Grid>
  );
}

function ProductTileImage({ imageUrl, title }: { imageUrl?: string; title: string }) {
  if (imageUrl) {
    return (
      <Image alt={title} borderRadius="22px" h="230px" objectFit="cover" src={imageUrl} w="full" />
    );
  }

  return (
    <Flex
      align="center"
      bg="linear-gradient(135deg, #151515 0%, #5f43f2 45%, #06b6d4 100%)"
      borderRadius="22px"
      color="white"
      h="230px"
      justify="center"
      overflow="hidden"
      position="relative"
    >
      <Box bg="white" borderRadius="12px 12px 22px 22px" h="112px" position="relative" w="96px">
        <Box
          border="8px solid white"
          borderBottom="0"
          borderRadius="999px 999px 0 0"
          h="48px"
          left="50%"
          position="absolute"
          top="-36px"
          transform="translateX(-50%)"
          w="58px"
        />
        <Box
          bg="pink.400"
          borderRadius="999px"
          boxShadow="0 0 0 12px #fed7e2"
          h="18px"
          left="50%"
          position="absolute"
          top="48%"
          transform="translate(-50%, -50%)"
          w="18px"
        />
      </Box>
      <Text bottom="18px" fontWeight="black" left="18px" position="absolute">
        {title}
      </Text>
    </Flex>
  );
}

function Qr({ value }: { value: string }) {
  return (
    <QrCode.Root bg="white" borderRadius="16px" p={2} size="lg" value={value}>
      <QrCode.Frame>
        <QrCode.Pattern />
      </QrCode.Frame>
    </QrCode.Root>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Card.Root bg="white" borderRadius="26px" boxShadow="0 18px 50px rgba(20, 20, 20, 0.08)" overflow="hidden">
      <Card.Body p={4}>
        <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />
        <Stack gap={3} mt={4}>
          <Flex align="start" justify="space-between">
            <Box>
              <Heading size="md">{listing.title}</Heading>
              <Text color="gray.500" fontSize="sm">
                {listing.category} at {listing.createdAt}
              </Text>
            </Box>
            <Badge colorPalette={listing.status === "live" ? "green" : listing.status === "sold" ? "pink" : "gray"}>
              {listing.status}
            </Badge>
          </Flex>
          <Text color="gray.600">{listing.description}</Text>
          <HStack justify="space-between">
            <Heading size="lg">{formatPrice(listing.price)}</Heading>
            <Badge colorPalette="orange">{listing.stock} left</Badge>
          </HStack>
          <HStack color="gray.500" fontSize="sm" justify="space-between">
            <Text>{listing.views} views</Text>
            <Text>{listing.saves} saves</Text>
            <Text>QR live</Text>
          </HStack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

function dropToListing(drop: import("./api").DropPublic): Listing {
  const status: ListingStatus =
    drop.state === "live" || drop.state === "partially_sold"
      ? "live"
      : drop.state === "sold_out"
        ? "sold"
        : "draft";
  return {
    id: drop.id,
    title: drop.title,
    description: drop.description || "",
    price: eurosFromCents(drop.price_cents),
    stock: drop.inventory,
    category: "Live drop",
    imageUrl: drop.media_url ?? "",
    prompt: "",
    status,
    views: 0,
    saves: 0,
    createdAt: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(drop.created_at)),
    slug: drop.slug,
    bunqTabUrl: drop.bunq_tab_url,
  };
}

function DashboardPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const liveCount = listings.filter((listing) => listing.status === "live").length;
  const stockCount = listings.reduce((total, listing) => total + listing.stock, 0);
  const totalViews = listings.reduce((total, listing) => total + listing.views, 0);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const drops = await api.listDrops({ limit: 100 });
      setListings(drops.map(dropToListing));
    } catch (err) {
      console.warn("listDrops failed, using local stub", err);
      setLoadError("Backend unreachable — showing demo data.");
      setListings(starterListings);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Box bg="#f8f1df" minH="100dvh" pb="112px">
      <Box maxW="1180px" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 5, md: 8 }}>
        <Flex align={{ base: "start", md: "center" }} direction={{ base: "column", md: "row" }} gap={4} justify="space-between">
          <Box>
            <Badge colorPalette="pink" mb={3}>
              Seller dashboard
            </Badge>
            <Heading letterSpacing="0" size={{ base: "3xl", md: "5xl" }}>
              Your quick marketplace
            </Heading>
            <Text color="gray.600" fontSize="lg" mt={3}>
              Camera-first listings for the stuff you want to sell right now.
            </Text>
          </Box>
          <HStack>
            <Badge colorPalette="green">bunq ready</Badge>
            <Badge colorPalette="cyan">AI online</Badge>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={7}>
          {[
            ["Live listings", liveCount.toString(), "green"],
            ["Items in stock", stockCount.toString(), "orange"],
            ["Total views", totalViews.toString(), "pink"],
          ].map(([label, value, color]) => (
            <Card.Root bg="white" borderRadius="24px" key={label}>
              <Card.Body p={5}>
                <Text color="gray.500" fontWeight="bold">
                  {label}
                </Text>
                <Heading color={`${color}.500`} size="3xl">
                  {value}
                </Heading>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>

        <Flex align="center" justify="space-between" mt={8} mb={4}>
          <Box>
            <Heading size="lg">Listings</Heading>
            <Text color="gray.500">Everything this seller has posted.</Text>
            {loadError ? (
              <Text color="orange.600" fontSize="sm" mt={1}>
                {loadError}
              </Text>
            ) : null}
          </Box>
          <Button colorPalette="gray" loading={isLoading} onClick={refresh} variant="outline">
            Refresh
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={5}>
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </SimpleGrid>
      </Box>

      <Flex bottom="24px" justify="center" left={0} pointerEvents="none" position="fixed" right={0} zIndex={20}>
        <Button
          aria-label="Open camera"
          bg="gray.950"
          border="6px solid"
          borderColor="#f8f1df"
          borderRadius="full"
          boxShadow="0 24px 60px rgba(20, 20, 20, 0.35)"
          color="white"
          h="86px"
          onClick={() => setCaptureOpen(true)}
          pointerEvents="auto"
          w="86px"
        >
          <CameraIcon />
        </Button>
      </Flex>

      {captureOpen ? (
        <CaptureOverlay
          onClose={() => setCaptureOpen(false)}
          onPost={(listing) => setListings((current) => [listing, ...current])}
        />
      ) : null}
    </Box>
  );
}

function CaptureOverlay({
  onClose,
  onPost,
}: {
  onClose: () => void;
  onPost: (listing: Listing) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const remoteMediaUrlRef = useRef<string | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);
  const [draft, setDraft] = useState<DraftListing>(emptyDraft);
  const [cameraError, setCameraError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [stage, setStage] = useState<"capture" | "review">("capture");

  const hasPhoto = Boolean(draft.imageUrl);
  const canGenerate = hasPhoto || draft.prompt.trim().length > 0;

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera is not available in this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Camera permission is blocked. Upload a photo instead.");
      }
    }

    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.toBlob(
      (blob) => {
        capturedBlobRef.current = blob ?? null;
        remoteMediaUrlRef.current = null; // re-upload on next generate
      },
      "image/jpeg",
      0.92,
    );
    setDraft((current) => ({ ...current, imageUrl: dataUrl }));
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    capturedBlobRef.current = file;
    remoteMediaUrlRef.current = null;
    setDraft((current) => ({ ...current, imageUrl: URL.createObjectURL(file) }));
  };

  const ensureMediaUploaded = async (): Promise<string | null> => {
    if (remoteMediaUrlRef.current) return remoteMediaUrlRef.current;
    if (!capturedBlobRef.current) return null;
    const name = capturedBlobRef.current.type.startsWith("image/")
      ? `capture-${Date.now()}.${(capturedBlobRef.current.type.split("/")[1] ?? "jpg")}`
      : `capture-${Date.now()}.bin`;
    const res = await api.uploadMedia(capturedBlobRef.current, name);
    remoteMediaUrlRef.current = res.url;
    return res.url;
  };

  const startVoice = async () => {
    setIsRecording(true);
    audioChunksRef.current = [];

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcript) {
          setDraft((current) => ({ ...current, prompt: transcript }));
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
    }

    try {
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setDraft((current) => ({
          ...current,
          audioUrl: blob.size > 0 ? URL.createObjectURL(blob) : current.audioUrl,
          prompt:
            current.prompt ||
            "Limited piece, looks great in person, ready for instant pickup and bunq payment.",
        }));
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      setDraft((current) => ({
        ...current,
        prompt: current.prompt || "Limited piece, ready for instant pickup and bunq payment.",
      }));
    }
  };

  const stopVoice = () => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const generateListing = async () => {
    setIsGenerating(true);
    setApiError("");
    try {
      // If user already pasted a dataURL (e.g. from file input URL.createObjectURL), ensure we have a Blob.
      if (!capturedBlobRef.current && draft.imageUrl.startsWith("data:")) {
        capturedBlobRef.current = await dataUrlToBlob(draft.imageUrl);
      }
      const mediaUrl = await ensureMediaUploaded();
      const pitch = draft.prompt.trim() || "Limited drop, ready to buy right now.";
      const preview = await api.generatePreview(pitch, mediaUrl);
      setDraft((current) => ({
        ...current,
        title: preview.title,
        description: preview.description,
        price: eurosFromCents(preview.price_cents),
        stock: current.stock || 1,
      }));
      setStage("review");
    } catch (err) {
      console.warn("generate-preview failed, using local stub", err);
      setApiError("AI unreachable; using local preview.");
      setDraft((current) => makeAiDraft(current));
      setStage("review");
    } finally {
      setIsGenerating(false);
    }
  };

  const postListing = async () => {
    setIsPosting(true);
    setApiError("");
    try {
      if (!capturedBlobRef.current && draft.imageUrl.startsWith("data:")) {
        capturedBlobRef.current = await dataUrlToBlob(draft.imageUrl);
      }
      const mediaUrl = await ensureMediaUploaded();
      const title = draft.title.trim() || titleFromPrompt(draft.prompt);
      const description = draft.description.trim() || draft.prompt.trim();
      const pitch = draft.prompt.trim() || null;
      const priceCents = centsFromEuros(draft.price);
      const inventory = Math.max(1, draft.stock || 1);

      const created = await api.createDrop({
        title,
        description,
        pitch,
        price_cents: priceCents,
        inventory,
        media_url: mediaUrl ?? null,
      });
      const reviewed = await api.moveToReview(created.id);
      const live = await api.publish(reviewed.id);

      onPost({
        id: live.id,
        title: live.title,
        description: live.description,
        price: eurosFromCents(live.price_cents),
        stock: live.inventory,
        category: draft.category || "Quick drop",
        imageUrl: draft.imageUrl,
        prompt: draft.prompt,
        status: "live",
        views: Math.floor(80 + Math.random() * 160),
        saves: Math.floor(10 + Math.random() * 35),
        createdAt: nowTime(),
        audioUrl: draft.audioUrl,
        slug: live.slug,
        bunqTabUrl: live.bunq_tab_url,
      });
      onClose();
    } catch (err) {
      console.error("publish failed", err);
      setApiError("Could not publish to backend. Listing kept locally.");
      const aiDraft = makeAiDraft(draft);
      onPost({
        id: createListingId(),
        title: aiDraft.title,
        description: aiDraft.description,
        price: aiDraft.price,
        stock: aiDraft.stock,
        category: aiDraft.category,
        imageUrl: aiDraft.imageUrl,
        prompt: aiDraft.prompt,
        status: "live",
        views: Math.floor(80 + Math.random() * 160),
        saves: Math.floor(10 + Math.random() * 35),
        createdAt: nowTime(),
        audioUrl: aiDraft.audioUrl,
      });
      onClose();
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Flex
      align="center"
      bg="blackAlpha.700"
      bottom={0}
      justify="center"
      left={0}
      p={{ base: 3, md: 6 }}
      position="fixed"
      right={0}
      top={0}
      zIndex={30}
    >
      <Card.Root borderRadius="32px" maxH="calc(100dvh - 32px)" maxW="1120px" overflow="auto" w="full">
        <Card.Body p={{ base: 4, md: 6 }}>
          <Flex align="center" justify="space-between" mb={5}>
            <Box>
              <Badge colorPalette={stage === "capture" ? "pink" : "green"} mb={2}>
                {stage === "capture" ? "Camera drop" : "AI prefill"}
              </Badge>
              <Heading size={{ base: "lg", md: "2xl" }}>
                {stage === "capture" ? "Snap the item and pitch it" : "Review the listing"}
              </Heading>
            </Box>
            <Button colorPalette="gray" onClick={onClose} variant="ghost">
              Close
            </Button>
          </Flex>

          <Grid gap={5} templateColumns={{ base: "1fr", lg: "1fr 0.95fr" }}>
            <Stack gap={4}>
              <Box bg="gray.950" borderRadius="28px" overflow="hidden" position="relative">
                {draft.imageUrl ? (
                  <Image alt="Captured product" h={{ base: "360px", md: "520px" }} objectFit="cover" src={draft.imageUrl} w="full" />
                ) : (
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={videoRef}
                    style={{
                      background: "#111",
                      display: "block",
                      height: "min(520px, 58vh)",
                      objectFit: "cover",
                      width: "100%",
                    }}
                  />
                )}
                <HStack bottom="18px" left="18px" position="absolute">
                  <Badge colorPalette={cameraError ? "orange" : "green"}>{cameraError || "Camera live"}</Badge>
                  {hasPhoto ? <Badge colorPalette="cyan">Photo locked</Badge> : null}
                </HStack>
              </Box>

              <HStack flexWrap="wrap" gap={3}>
                <Button colorPalette="pink" onClick={capturePhoto}>
                  Capture photo
                </Button>
                <Button as="label" colorPalette="gray" cursor="pointer" variant="outline">
                  Upload
                  <Input accept="image/*" display="none" onChange={handleUpload} type="file" />
                </Button>
                <Button
                  colorPalette={isRecording ? "red" : "cyan"}
                  onClick={isRecording ? stopVoice : startVoice}
                  variant={isRecording ? "solid" : "surface"}
                >
                  <MicIcon active={isRecording} />
                  {isRecording ? "Stop voice" : "Voice pitch"}
                </Button>
              </HStack>

              <HStack gap={2}>
                {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                  <Box
                    bg={isRecording ? "pink.400" : "gray.200"}
                    borderRadius="full"
                    h={isRecording ? `${18 + ((bar * 11) % 36)}px` : "10px"}
                    key={bar}
                    transition="height 160ms ease"
                    w="100%"
                  />
                ))}
              </HStack>
            </Stack>

            <Stack gap={4}>
              <Card.Root bg="#fbfbf6" borderRadius="24px" variant="outline">
                <Card.Body p={5}>
                  <HStack color="pink.500" mb={3}>
                    <SparkIcon />
                    <Text fontWeight="black">Prompt input</Text>
                  </HStack>
                  <Textarea
                    minH="140px"
                    placeholder="Type or say the pitch: what is it, why should someone buy it, price/stock vibes..."
                    value={draft.prompt}
                    onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                  />
                  {draft.audioUrl ? (
                    <Box mt={3}>
                      <audio controls src={draft.audioUrl} style={{ width: "100%" }} />
                    </Box>
                  ) : null}
                  <Button
                    colorPalette="purple"
                    disabled={!canGenerate}
                    loading={isGenerating}
                    mt={4}
                    onClick={generateListing}
                    w="full"
                  >
                    AI prefill listing
                  </Button>
                </Card.Body>
              </Card.Root>

              <Card.Root bg="white" borderRadius="24px" variant="outline">
                <Card.Body p={5}>
                  <Heading mb={4} size="md">
                    Listing modal
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        Title
                      </Text>
                      <Input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        Category
                      </Text>
                      <Input
                        value={draft.category}
                        onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        Price
                      </Text>
                      <Input
                        value={draft.price}
                        onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        Stock
                      </Text>
                      <Input
                        min={0}
                        type="number"
                        value={draft.stock}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, stock: Math.max(0, Number(event.target.value) || 0) }))
                        }
                      />
                    </Box>
                  </SimpleGrid>
                  <Box mt={3}>
                    <Text fontSize="sm" fontWeight="bold" mb={1}>
                      Description
                    </Text>
                    <Textarea
                      minH="120px"
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Box>
                  {apiError ? (
                    <Text color="orange.600" fontSize="sm" mt={2}>
                      {apiError}
                    </Text>
                  ) : null}
                  <Button colorPalette="green" disabled={!canGenerate} loading={isPosting} mt={4} onClick={postListing} size="lg" w="full">
                    Post listing
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

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEventLike) => void;
  start: () => void;
  stop: () => void;
};

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
