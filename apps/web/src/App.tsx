import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Box, Flex, Grid, Image, Link, QrCode, SimpleGrid, Spinner, Text, Textarea } from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, buyerCheckoutUrl, centsFromEuros, clearAuth, dataUrlToBlob, eurosFromCents, getStoredSeller, persistAuth, persistSeller, type DropDetail, type DropPublic, type DropState, type NotificationPublic, type SellerPublic } from "./api";
import { G, DARK, INK_FG, BG, SURFACE, CARD, BORDER, TEXT, MUTED, FONT, PANEL } from "./theme/tokens";
import HeroPage from "./components/HeroPage";
import { BunqWordmark } from "./components/BunqWordmark";
import { GlassCard } from "./components/GlassCard";
import { HagglePanel } from "./components/HagglePanel";
import { ProductTileImage } from "./components/ProductTileImage";
import { VoiceWave } from "./components/VoiceWave";
import { PaymentCelebration, type CelebrationData } from "./components/PaymentCelebration";
import { ListingCard, type Listing } from "./components/ListingCard";
import { EditModal } from "./components/EditModal";
import { ListingPreviewModal } from "./components/ListingPreviewModal";

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

type DropStatusFilter = DropState;

const statusTabs: Array<{ value: DropStatusFilter; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "sold_out", label: "Sold" },
  { value: "archived", label: "Archived" },
];

function statusTabLabel(value: DropStatusFilter): string {
  return statusTabs.find((tab) => tab.value === value)?.label ?? value;
}

function statusFilterSummary(filters: DropStatusFilter[]): string {
  if (filters.length === 0) return "All statuses";
  if (filters.length === 1) return statusTabLabel(filters[0]);
  if (filters.length <= 3) return filters.map(statusTabLabel).join(" + ");
  return `${filters.length} statuses`;
}

function listingMatchesFilter(listing: Listing, filters: DropStatusFilter[]): boolean {
  return filters.length === 0 || (listing.state ? filters.includes(listing.state) : false);
}

function dropToListing(drop: DropPublic): Listing {
  const status =
    drop.state === "live" ? "live" as const
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
  if (state === "live") return "ready";
  return "unavailable";
}

function dropStateLabel(state: DropState): string {
  switch (state) {
    case "live": return "Live now";
    case "sold_out": return "Sold out";
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
  description: string; price: string; floorPrice: string; stock: number;
  category: string; audioUrl?: string; expiresDate?: string; expiresTime?: string;
};

const emptyDraft: DraftListing = {
  imageUrl: "", prompt: "", title: "", description: "", price: "", floorPrice: "", stock: 1, category: "Quick drop",
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
        <BunqWordmark height={48} />
        <Box h="24px" w="1px" bg={BORDER} flexShrink={0} />

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
type SaleNotification = { id: string; title: string; amount: string; time: string; read: boolean };

function notifFromApi(n: NotificationPublic): SaleNotification {
  return {
    id: n.id,
    title: n.drop_title,
    amount: `€ ${(n.amount_cents / 100).toFixed(2)}`,
    time: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(n.created_at)),
    read: n.read,
  };
}

function DashboardPage() {
  const navigate                   = useNavigate();
  const { dark, toggle }           = useTheme();
  const [seller, setSeller]        = useState<SellerPublic | null>(() => getStoredSeller());
  const [listings, setListings]    = useState<Listing[]>([]);
  const [loading, setLoading]      = useState(true);
  const [loadError, setLoadError]  = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editTarget, setEditTarget]   = useState<Listing | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Listing | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<DropStatusFilter[]>([]);
  const [notifications, setNotifications] = useState<SaleNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const sellerId = seller?.id ?? "";
  const sellerName = seller?.display_name ?? "";

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleCelebrate = useCallback((d: CelebrationData) => {
    setCelebration(d);
    setNotifications((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        title: d.title,
        amount: d.amount,
        time: nowTime(),
        read: false,
      },
      ...prev,
    ].slice(0, 30));
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.markNotificationsRead().catch(() => {});
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

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
      const status = activeStatuses.length > 0 ? activeStatuses : undefined;
      let drops = await api.listDrops({ status, seller_id: sellerId || undefined, limit: 100 });
      if (sellerId && drops.length === 0) {
        drops = await api.listDrops({ status, limit: 100 });
      }
      setListings(drops.map(dropToListing));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not reach backend.");
    } finally {
      setLoading(false);
    }
  }, [activeStatuses, sellerId]);

  useEffect(() => { fetchDrops(); }, [fetchDrops]);

  useEffect(() => {
    if (!sellerId) return;
    api.listNotifications()
      .then((list) => setNotifications(list.map(notifFromApi)))
      .catch(() => {});
  }, [sellerId]);

  const updateListing = useCallback((id: string, u: Partial<Listing>) => {
    setListings((cur) =>
      cur
        .map((l) => l.id === id ? { ...l, ...u } : l)
        .filter((l) => listingMatchesFilter(l, activeStatuses))
    );
  }, [activeStatuses]);

  const toggleStatus = useCallback((value: DropStatusFilter) => {
    setActiveStatuses((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }, []);

  return (
    <Box bg={BG} minH="100dvh" pb="120px" position="relative" className="page-enter">
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
          <BunqWordmark height={32}/>

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

            {/* Notification bell */}
            <Box position="relative" ref={notifRef as React.RefObject<HTMLDivElement>}>
              <Box
                as="button"
                onClick={() => setNotifOpen((o) => !o)}
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
                position="relative"
                title="Notifications"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-1.29 1.29A1 1 0 0 0 5.41 19H18.6a1 1 0 0 0 .7-1.71L18 16Z" fill="currentColor" />
                </svg>
                {unreadCount > 0 && (
                  <Box
                    position="absolute"
                    top="-2px"
                    right="-2px"
                    w="14px"
                    h="14px"
                    borderRadius="50%"
                    bg="#dc2626"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontFamily={FONT} fontSize="9px" fontWeight="700" color="white" lineHeight={1}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </Box>
                )}
              </Box>

              {notifOpen && (
                <Box
                  position="absolute"
                  top="calc(100% + 8px)"
                  right={0}
                  w="300px"
                  bg={CARD}
                  border="1px solid"
                  borderColor={BORDER}
                  borderRadius="12px"
                  boxShadow="0 8px 32px rgba(0,0,0,0.16)"
                  zIndex={50}
                  overflow="hidden"
                >
                  <Box px="14px" py="10px" borderBottom="1px solid" borderColor={BORDER}>
                    <Text fontFamily={FONT} fontSize="12px" fontWeight="700" color={TEXT} textTransform="uppercase" letterSpacing="0.06em">
                      Sales
                    </Text>
                  </Box>
                  {notifications.length === 0 ? (
                    <Box px="14px" py="20px" textAlign="center">
                      <Text fontFamily={FONT} fontSize="13px" color={MUTED}>No sales yet</Text>
                    </Box>
                  ) : (
                    <Box maxH="320px" overflowY="auto">
                      {notifications.map((n) => (
                        <Box
                          key={n.id}
                          px="14px"
                          py="10px"
                          borderBottom="1px solid"
                          borderColor={BORDER}
                          bg={n.read ? "transparent" : SURFACE}
                          _last={{ borderBottom: "none" }}
                        >
                          <Flex justify="space-between" align="center" mb="2px">
                            <Text fontFamily={FONT} fontSize="13px" fontWeight="600" color={TEXT} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="180px">
                              {n.title}
                            </Text>
                            <Text fontFamily={FONT} fontSize="13px" fontWeight="700" color="#16a34a">
                              {n.amount}
                            </Text>
                          </Flex>
                          <Text fontFamily={FONT} fontSize="11px" color={MUTED}>{n.time}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>

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
              {loading ? "Loading…" : loadError || `${statusFilterSummary(activeStatuses)} · ${listings.length} total`}
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

        {/* Status filters */}
        <Box mb="16px">
          <Flex
            align="center"
            gap="8px"
            flexWrap="wrap"
          >
            <Box
              as="button"
              h="34px"
              px="14px"
              borderRadius="999px"
              border="1px solid"
              borderColor={activeStatuses.length === 0 ? TEXT : BORDER}
              bg={activeStatuses.length === 0 ? TEXT : CARD}
              color={activeStatuses.length === 0 ? BG : MUTED}
              cursor="pointer"
              fontFamily={FONT}
              fontSize="13px"
              fontWeight={activeStatuses.length === 0 ? "700" : "500"}
              whiteSpace="nowrap"
              onClick={() => setActiveStatuses([])}
            >
              All
            </Box>
            {statusTabs.map((tab) => {
              const selected = activeStatuses.includes(tab.value);
              return (
                <Box
                  as="button"
                  key={tab.value}
                  h="34px"
                  px="14px"
                  borderRadius="999px"
                  border="1px solid"
                  borderColor={selected ? TEXT : BORDER}
                  bg={selected ? TEXT : CARD}
                  color={selected ? BG : MUTED}
                  cursor="pointer"
                  fontFamily={FONT}
                  fontSize="13px"
                  fontWeight={selected ? "700" : "500"}
                  whiteSpace="nowrap"
                  transition="background 150ms ease, color 150ms ease, border-color 150ms ease"
                  _hover={{ borderColor: TEXT, color: selected ? BG : TEXT }}
                  onClick={() => toggleStatus(tab.value)}
                >
                  {tab.label}
                </Box>
              );
            })}
          </Flex>
        </Box>

        {/* Grid */}
        {loading ? (
          <Flex justify="center" py="80px"><Spinner size="xl" /></Flex>
        ) : listings.length === 0 ? (
          <GlassCard borderRadius="12px" p="64px 24px" textAlign="center">
            <Text fontFamily={FONT} fontSize="16px" fontWeight="600" color={TEXT} mb="6px">No {statusFilterSummary(activeStatuses).toLowerCase()} listings</Text>
            <Text fontFamily={FONT} fontSize="14px" color={MUTED}>Switch status tabs or tap the button below to create a drop.</Text>
          </GlassCard>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={{ base: "12px", md: "16px" }}>
            {listings.map((l) => (
              <ListingCard
                key={l.id} listing={l}
                onUpdate={(u) => updateListing(l.id, u)}
                onPreview={() => setPreviewTarget(l)}
                onEdit={() => setEditTarget(l)}
                onWall={() => navigate(`/wall/${l.slug}`)}
                onCelebrate={handleCelebrate}
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
          onPost={(l) => {
            if (listingMatchesFilter(l, activeStatuses)) {
              setListings((cur) => [l, ...cur]);
            } else {
              fetchDrops();
            }
          }}
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
      {previewTarget && (
        <ListingPreviewModal
          listing={previewTarget}
          onClose={() => setPreviewTarget(null)}
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
  const expiryInvalid = Boolean(
    draft.expiresDate && draft.expiresTime &&
    new Date(`${draft.expiresDate}T${draft.expiresTime}`) <= new Date()
  ) || Boolean(draft.expiresDate && !draft.expiresTime);
  const canPublish  = canGenerate && !expiryInvalid;
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
      setDraft((d) => ({ ...d, title: preview.title, description: preview.description, price: eurosFromCents(preview.price_cents), floorPrice: preview.floor_price_cents != null ? eurosFromCents(preview.floor_price_cents) : d.floorPrice }));
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
      const expiresIso = (draft.expiresDate && draft.expiresTime)
        ? new Date(`${draft.expiresDate}T${draft.expiresTime}`).toISOString()
        : null;
      const floorCents = draft.floorPrice.trim() ? centsFromEuros(draft.floorPrice) : null;
      const created  = await api.createDrop({ title: draft.title.trim() || titleFromPrompt(draft.prompt), description: draft.description.trim(), pitch: draft.prompt.trim() || null, price_cents: centsFromEuros(draft.price), floor_price_cents: floorCents, inventory: Math.max(1, draft.stock), media_url: mediaUrl, expires_at: expiresIso });
      const live     = await api.publish(created.id);
      onPost({ id: live.id, slug: live.slug, title: live.title, description: live.description, price: eurosFromCents(live.price_cents), stock: live.inventory, category: draft.category, imageUrl: draft.imageUrl, prompt: draft.prompt, status: "live", state: live.state, createdAt: nowTime(), audioUrl: draft.audioUrl, bunqTabUrl: live.bunq_tab_url, expiresAt: live.expires_at ?? undefined });
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
            <BunqWordmark height={24} />
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
                <Box
                  as="button"
                  mt="6px"
                  fontFamily={FONT}
                  fontSize="12px"
                  color={MUTED}
                  bg="transparent"
                  border="none"
                  cursor="pointer"
                  p="0"
                  _hover={{ color: "#dc2626" }}
                  onClick={() => {
                    URL.revokeObjectURL(draft.audioUrl!);
                    setDraft((d) => ({ ...d, audioUrl: undefined, prompt: "" }));
                  }}
                >
                  ✕ Delete recording &amp; re-record
                </Box>
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
                <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">Ends at <Box as="span" fontWeight="400" textTransform="none" letterSpacing="normal">(optional)</Box></Text>
                <Grid templateColumns="1fr 1fr" gap="8px">
                  <Box
                    as="input"
                    type="date"
                    {...inputBase as any}
                    min={new Date().toISOString().slice(0, 10)}
                    value={draft.expiresDate ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDraft((d) => ({ ...d, expiresDate: e.target.value || undefined }))
                    }
                    style={{ colorScheme: "light dark" }}
                  />
                  <Box
                    as="input"
                    type="time"
                    {...inputBase as any}
                    value={draft.expiresTime ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDraft((d) => ({ ...d, expiresTime: e.target.value || undefined }))
                    }
                    style={{ colorScheme: "light dark" }}
                  />
                </Grid>
                {draft.expiresDate && !draft.expiresTime && (
                  <Text fontFamily={FONT} fontSize="11px" color="#f59e0b" mt="4px">Pick a time too</Text>
                )}
                {draft.expiresDate && draft.expiresTime && new Date(`${draft.expiresDate}T${draft.expiresTime}`) <= new Date() && (
                  <Text fontFamily={FONT} fontSize="11px" color="#dc2626" mt="4px">End time must be in the future</Text>
                )}
              </Box>

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
              opacity={isPosting || !canPublish ? 0.6 : 1}
              cursor={isPosting || !canPublish ? "not-allowed" : "pointer"}
              onClick={!isPosting && canPublish ? postListing : undefined}
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

function useWallCountdown(expiresAt?: string | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
}

function fmtWallCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function LiveWallPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<DropDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<WallActivity[]>([]);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const dropRef = useRef<DropDetail | null>(null);
  useWallCountdown(drop?.expires_at);

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
          result.state === "live"
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
    return (
      <Flex minH="100dvh" bg="#090909" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!drop) {
    return (
      <Flex minH="100dvh" bg="#090909" align="center" justify="center" p={6}>
        <Box className="glass-card" borderRadius="20px" p={{ base: "28px", md: "36px" }} maxW="440px" w="full">
          <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color={MUTED} textTransform="uppercase" letterSpacing="0.12em">Live wall</Text>
          <Text fontFamily={FONT} fontSize="28px" fontWeight="700" color={TEXT} letterSpacing="-0.8px" mt="12px">
            Wall unavailable
          </Text>
          <Text fontFamily={FONT} fontSize="14px" color={MUTED} mt="10px" lineHeight="1.6">
            {error || "The requested drop could not be loaded."}
          </Text>
          <Box as="button" {...btnPrimary} mt="24px" h="44px" w="full" onClick={() => navigate("/dashboard")}>
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
    : drop.state === "draft" ? "Preparing to go live"
    : "Scan to pay instantly";
  const isLive = drop.state === "live";
  const dotClass = drop.state === "live" ? "dot-live" : undefined;
  const isSoldOut = drop.state === "sold_out";
  const total = drop.inventory + drop.sold_count;
  const soldPct = total > 0 ? Math.min(100, Math.round((drop.sold_count / total) * 100)) : 0;

  return (
    <Box minH="100dvh" bg={BG} position="relative" overflow="hidden" className="page-enter">
      <Box className="grad-bg">
        <Box className="grad-orb orb-1" />
        <Box className="grad-orb orb-2" />
        <Box className="grad-orb orb-3" />
      </Box>

      {/* Nav — matches dashboard glass nav */}
      <Box
        className="glass-nav"
        position="sticky"
        top={0}
        zIndex={10}
        px={{ base: "18px", md: "32px" }}
        h="60px"
        display="grid"
        gridTemplateColumns="auto minmax(0,1fr) auto"
        alignItems="center"
        gap="12px"
      >
        {/* Left: back arrow + logo */}
        <Flex align="center" gap="12px">
          <Box
            as="button"
            bg="none" border="none" color={TEXT}
            cursor="pointer" display="inline-flex" alignItems="center"
            p="4px" flexShrink={0}
            _hover={{ opacity: 0.6 }}
            onClick={() => navigate("/dashboard")}
          >
            <svg width="28" height="20" viewBox="0 0 36 24" fill="none">
              <path d="M34 12H2M2 12l10-9M2 12l10 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
          <Box h="16px" w="1px" bg={BORDER} flexShrink={0} display={{ base: "none", md: "block" }} />
          <Box display={{ base: "none", md: "block" }}>
            <BunqWordmark height={32} />
          </Box>
        </Flex>

        {/* Center: title */}
        <Text fontFamily={FONT} fontSize={{ base: "13px", md: "14px" }} fontWeight="600" color={TEXT} textAlign="center" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis" display={{ base: "none", sm: "block" }}>
          {drop.title}
        </Text>

        {/* Right: live status */}
        <Flex align="center" gap="7px" justify="flex-end">
          <Box
            w="7px" h="7px" borderRadius="50%"
            position="relative" flexShrink={0}
            className={[dotClass, isLive ? "live-pulse" : undefined].filter(Boolean).join(" ") || undefined}
            style={isLive ? { backgroundColor: "#ef4444", "--dot-clr": "#ef4444" } as React.CSSProperties : { backgroundColor: MUTED }}
          />
          <Text fontFamily={FONT} fontSize="12px" fontWeight="600" color={isLive ? TEXT : MUTED} whiteSpace="nowrap">
            {dropStateLabel(drop.state)}
          </Text>
        </Flex>
      </Box>

      {/* Content */}
      <Box
        position="relative" zIndex={1}
        px={{ base: "16px", md: "28px", xl: "40px" }}
        py={{ base: "20px", md: "28px" }}
        maxW="1400px" mx="auto"
      >
        <Grid templateColumns={{ base: "1fr", xl: "1fr 400px" }} gap={{ base: "16px", xl: "20px" }} alignItems="start">

          {/* Left: image + info as separate cards */}
          <Flex direction="column" gap={{ base: "16px", xl: "20px" }}>

            {/* Image card */}
            <Box className="glass-card" borderRadius="20px" overflow="hidden" position="relative">
              {drop.media_url ? (
                <img
                  src={drop.media_url}
                  alt={drop.title}
                  style={{ width: "100%", height: "auto", display: "block", maxHeight: "30vh", objectFit: "contain" }}
                />
              ) : (
                <Box h="260px" bg={SURFACE} display="flex" alignItems="center" justifyContent="center">
                  <Text fontFamily={FONT} fontSize="12px" color={MUTED}>No image</Text>
                </Box>
              )}
              <Box
                position="absolute" insetX={0} bottom={0}
                p={{ base: "16px", md: "24px" }}
                bg="linear-gradient(to top, rgba(0,0,0,0.70) 0%, transparent 100%)"
              >
                <Box
                  display="inline-flex" alignItems="center" gap="6px"
                  px="10px" py="5px" borderRadius="20px"
                  bg={isLive ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.45)"}
                  style={{ backdropFilter: "blur(6px)" }}
                  border="1px solid rgba(255,255,255,0.18)"
                >
                  {isLive && <Box w="6px" h="6px" borderRadius="50%" position="relative" className={[dotClass, "live-pulse"].filter(Boolean).join(" ")} />}
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color="white" letterSpacing="0.06em">
                    {dropStateLabel(drop.state).toUpperCase()}
                  </Text>
                </Box>
              </Box>
            </Box>

            {/* Info card */}
            <Box className="glass-card" borderRadius="20px" p={{ base: "22px", md: "28px" }}>
              <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color={MUTED} textTransform="uppercase" letterSpacing="0.12em" mb="10px">
                Live storefront
              </Text>
              <Text fontFamily={FONT} fontSize={{ base: "28px", md: "38px", xl: "48px" }} lineHeight={0.95} fontWeight="700" letterSpacing="-2px" color={TEXT}>
                {drop.title}
              </Text>
              {drop.description && (
                <Text fontFamily={FONT} fontSize={{ base: "14px", md: "15px" }} color={MUTED} mt="12px" lineHeight="1.6">
                  {drop.description}
                </Text>
              )}

                <SimpleGrid columns={{ base: 2, md: drop.expires_at ? 4 : 3 }} gap="12px" mt={{ base: "24px", xl: "28px" }}>
                {[
                  { label: "Price", value: `€ ${eurosFromCents(drop.price_cents)}` },
                  { label: "Remaining", value: String(Math.max(0, drop.inventory)) },
                  { label: "Sold", value: String(drop.sold_count) },
                  ...(drop.expires_at ? [{ label: "Ends in", value: fmtWallCountdown(drop.expires_at) }] : []),
                ].map((item) => (
                  <Box
                    key={item.label}
                    className="glass-card"
                    borderRadius="14px"
                    p={{ base: "14px", md: "16px" }}
                  >
                    <Text fontFamily={FONT} fontSize="10px" fontWeight="700" color={MUTED} textTransform="uppercase" letterSpacing="0.08em">
                      {item.label}
                    </Text>
                    <Text fontFamily={FONT} fontSize={{ base: "24px", md: "28px" }} fontWeight="700" letterSpacing="-0.8px" color={TEXT} mt="6px">
                      {item.value}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>

              {/* Inventory progress bar */}
              {total > 0 && (
                <Box mt="16px">
                  <Flex justify="space-between" mb="8px">
                    <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED}>Sold</Text>
                    <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED}>{soldPct}%</Text>
                  </Flex>
                  <Box h="5px" bg={SURFACE} borderRadius="full" overflow="hidden">
                    <Box
                      h="full" w={`${soldPct}%`}
                      bg={isSoldOut ? MUTED : TEXT}
                      borderRadius="full"
                      transition="width 0.6s ease"
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Flex>

          {/* Right: QR + activity */}
          <Flex direction="column" gap="16px">
            {/* QR card */}
            <Box className="glass-card" borderRadius="20px" p={{ base: "22px", md: "26px" }}>
              <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color={MUTED} textTransform="uppercase" letterSpacing="0.12em" mb="6px">
                {isSoldOut ? "Sold out" : isLive ? "Scan to pay" : dropStateLabel(drop.state)}
              </Text>
              <Text fontFamily={FONT} fontSize="15px" fontWeight="600" color={TEXT} lineHeight="1.4" mb="20px">
                Point your camera, tap, done.
              </Text>

              <Box p="14px" bg={CARD} borderRadius="16px" border="1px solid" borderColor={BORDER}>
                <Box display="flex" justifyContent="center">
                  <QrCode.Root value={checkoutUrl} size="lg">
                    <QrCode.Frame>
                      <QrCode.Pattern />
                    </QrCode.Frame>
                  </QrCode.Root>
                </Box>
              </Box>

              <Flex gap="8px" mt="16px">
                <Box
                  as="button" flex={1}
                  {...btnPrimary} h="40px" fontSize="13px"
                  onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
                >
                  Test checkout
                </Box>
                {drop.bunq_tab_url && (
                  <Box
                    as="button"
                    {...btnOutline} h="40px" px="14px" fontSize="13px"
                    onClick={() => window.open(drop.bunq_tab_url ?? "", "_blank", "noopener,noreferrer")}
                  >
                    bunq link
                  </Box>
                )}
              </Flex>
            </Box>

            {/* Activity feed */}
            <Box className="glass-card" borderRadius="20px" p={{ base: "20px", md: "22px" }}>
              <Flex align="center" justify="space-between" mb="16px">
                <Text fontFamily={FONT} fontSize="11px" fontWeight="700" color={MUTED} textTransform="uppercase" letterSpacing="0.12em">
                  Live activity
                </Text>
                <Flex align="center" gap="6px">
                  <Box w="6px" h="6px" borderRadius="50%" position="relative" className={[dotClass, isLive ? "live-pulse" : undefined].filter(Boolean).join(" ") || undefined} flexShrink={0} />
                  <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={isLive ? TEXT : MUTED}>
                    {isLive ? "Live" : "Offline"}
                  </Text>
                </Flex>
              </Flex>

              {activity.length === 0 ? (
                <Text fontFamily={FONT} fontSize="13px" color={MUTED}>Waiting for activity…</Text>
              ) : (
                <Flex direction="column" gap="8px">
                  {activity.map((item) => (
                    <Flex
                      key={item.id} align="start" gap="10px" p="12px" borderRadius="12px"
                      bg={item.tone === "sale" ? SURFACE : "transparent"}
                      border="1px solid" borderColor={item.tone === "sale" ? BORDER : "transparent"}
                    >
                      <Box
                        w="7px" h="7px" mt="5px" borderRadius="50%" flexShrink={0}
                        bg={item.tone === "sale" ? TEXT : item.tone === "state" ? "#f6ad55" : MUTED}
                      />
                      <Box flex={1}>
                        <Text fontFamily={FONT} fontSize="13px" fontWeight={item.tone === "sale" ? "700" : "500"} color={TEXT} lineHeight="1.45">
                          {item.text}
                        </Text>
                        <Text fontFamily={FONT} fontSize="11px" color={MUTED} mt="3px">{item.time}</Text>
                      </Box>
                    </Flex>
                  ))}
                </Flex>
              )}
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
  const [haggleCents, setHaggleCents] = useState<number | null>(null);

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

          <Flex align="baseline" justify="space-between" mt="20px" mb="18px" gap="16px" wrap="wrap">
            <Box>
              {haggleCents != null && haggleCents !== drop.price_cents ? (
                <Flex align="baseline" gap="10px">
                  <Text fontFamily={FONT} fontSize="30px" fontWeight="700" color={TEXT} letterSpacing="-0.7px">
                    € {eurosFromCents(haggleCents)}
                  </Text>
                  <Text fontFamily={FONT} fontSize="14px" color={MUTED} textDecoration="line-through">
                    € {eurosFromCents(drop.price_cents)}
                  </Text>
                  <Box bg={G} color="black" fontFamily={FONT} fontSize="10px" fontWeight="800" letterSpacing="0.16em" textTransform="uppercase" px="6px" py="3px" borderRadius="4px">
                    Haggled
                  </Box>
                </Flex>
              ) : (
                <Text fontFamily={FONT} fontSize="30px" fontWeight="700" color={TEXT} letterSpacing="-0.7px">
                  € {eurosFromCents(drop.price_cents)}
                </Text>
              )}
            </Box>
            <Text fontFamily={FONT} fontSize="12px" color={MUTED}>
              {Math.max(0, drop.inventory)} left
            </Text>
          </Flex>

          {checkoutState === "ready" && (
            <Box mb="18px">
              <HagglePanel
                slug={drop.slug}
                listedPriceCents={drop.price_cents}
                onDeal={(cents) => setHaggleCents(cents)}
              />
            </Box>
          )}

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
            {checkoutState === "paid"
              ? "Already paid"
              : checkoutState === "unavailable"
              ? "Unavailable"
              : paying
              ? "Processing payment…"
              : haggleCents != null && haggleCents !== drop.price_cents
              ? `Pay haggled € ${eurosFromCents(haggleCents)}`
              : "Pay now"}
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
        <Route index element={<HeroPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/inspo" element={<Navigate replace to="/" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wall/:slug" element={<LiveWallPage />} />
        <Route path="/buy/:slug" element={<BuyerCheckoutPage />} />
        <Route path="/buy/:slug/success" element={<BuyerSuccessPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
