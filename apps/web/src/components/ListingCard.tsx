import { useEffect, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { api, buyerCheckoutUrl, eurosFromCents, type DropState } from "../api";
import { TEXT, MUTED, FONT } from "../theme/tokens";
import { ProductTileImage } from "./ProductTileImage";
import { BunqQrPanel } from "./BunqQrPanel";
import { GlassCard } from "./GlassCard";
import type { CelebrationData } from "./PaymentCelebration";

export type ListingStatus = "live" | "sold" | "draft";

export type Listing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: string;
  stock: number;
  category: string;
  imageUrl: string;
  prompt: string;
  status: ListingStatus;
  state?: DropState;
  createdAt: string;
  audioUrl?: string;
  bunqTabUrl?: string | null;
};

function listingStatusFromDropState(state: DropState | undefined): ListingStatus {
  if (state === "live" || state === "partially_sold") return "live";
  if (state === "sold_out") return "sold";
  return "draft";
}

function fmt(price: string) {
  const n = Number(price);
  return `€ ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export function ListingCard({
  listing,
  onUpdate,
  onPreview,
  onEdit,
  onCelebrate,
}: {
  listing: Listing;
  onUpdate: (u: Partial<Listing>) => void;
  onPreview: () => void;
  onEdit: () => void;
  onCelebrate: (d: CelebrationData) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!listing.slug || listing.status !== "live") return;
    const es = api.streamDrop(listing.slug);

    es.addEventListener("payment", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string);
        const nextState = data.drop_state as DropState | undefined;
        onUpdate({
          stock: Math.max(0, data.inventory ?? listing.stock),
          state: nextState,
          status: listingStatusFromDropState(nextState),
        });
        onCelebrate({
          title: listing.title,
          amount: fmt(eurosFromCents(data.amount_cents ?? Math.round(Number(listing.price) * 100))),
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("state_changed", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string);
        const nextState = data.state as DropState | undefined;
        if (nextState) {
          onUpdate({
            state: nextState,
            status: listingStatusFromDropState(nextState),
            stock: nextState === "sold_out" ? 0 : Math.max(0, data.inventory ?? listing.stock),
          });
        } else if (data.inventory != null) {
          onUpdate({ stock: Math.max(0, data.inventory) });
        }
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [listing.slug, listing.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = listing.state ?? (listing.status === "live" ? "live" : listing.status === "sold" ? "sold_out" : "draft");
  const isShareable = st === "live" || st === "partially_sold";
  const shareUrl = buyerCheckoutUrl(listing.slug);

  const stopAndRun = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  const shareListing = async () => {
    if (!isShareable) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text: listing.description,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Share is user-cancelable, so no noisy error state.
    }
  };

  function IconButton({
    label,
    children,
    onClick,
  }: {
    label: string;
    children: React.ReactNode;
    onClick: (event: React.MouseEvent) => void;
  }) {
    return (
      <Box
        as="button"
        aria-label={label}
        title={label}
        bg="rgba(255,255,255,0.92)"
        border="1px solid rgba(0,0,0,0.08)"
        borderRadius="50%"
        boxShadow="0 6px 18px rgba(0,0,0,0.16)"
        color="black"
        cursor="pointer"
        display="flex"
        alignItems="center"
        justifyContent="center"
        h="34px"
        w="34px"
        onClick={onClick}
        _hover={{ transform: "translateY(-1px)", bg: "white" }}
      >
        {children}
      </Box>
    );
  }

  function IconPreview() {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M2.75 12s3.25-6.25 9.25-6.25S21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  function IconEdit() {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4.75 19.25h14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m6.25 14.75-.5 3.5 3.5-.5 8.9-8.9a2.48 2.48 0 0 0-3.5-3.5l-8.4 9.4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  function IconShare() {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M8.75 12.8 15.25 16.4M15.25 7.6 8.75 11.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M6.5 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM17.5 8.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM17.5 20.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  function StatusBadge() {
    if (st === "live" || st === "partially_sold") {
      return (
        <Flex align="center" gap="5px" bg="white" borderRadius="20px" px="8px" py="4px" boxShadow="0 1px 6px rgba(0,0,0,0.14)">
          <Box bg="black" borderRadius="full" h="6px" w="6px" flexShrink={0} position="relative" className="live-pulse" />
          <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="black">
            {st === "partially_sold" ? "Selling" : "Live"}
          </Text>
        </Flex>
      );
    }
    if (st === "sold_out") {
      return (
        <Box bg="rgba(0,0,0,0.75)" borderRadius="20px" px="8px" py="4px" style={{ backdropFilter: "blur(6px)" }}>
          <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="white">Sold out</Text>
        </Box>
      );
    }
    if (st === "review" || st === "processing") {
      return (
        <Box bg="rgba(200,140,20,0.85)" borderRadius="20px" px="8px" py="4px" style={{ backdropFilter: "blur(6px)" }}>
          <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="white">In review</Text>
        </Box>
      );
    }
    if (st === "paused") {
      return (
        <Box bg="rgba(80,80,90,0.80)" borderRadius="20px" px="8px" py="4px" style={{ backdropFilter: "blur(6px)" }}>
          <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="white">Paused</Text>
        </Box>
      );
    }
    if (st === "expired") {
      return (
        <Box bg="rgba(160,50,50,0.80)" borderRadius="20px" px="8px" py="4px" style={{ backdropFilter: "blur(6px)" }}>
          <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="white">Expired</Text>
        </Box>
      );
    }
    return (
      <Box bg="rgba(0,0,0,0.45)" borderRadius="20px" px="8px" py="4px" style={{ backdropFilter: "blur(6px)" }}>
        <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="white">Draft</Text>
      </Box>
    );
  }

  return (
    <GlassCard
      borderRadius="12px"
      cursor="pointer"
      onClick={onPreview}
      transition="transform 180ms ease, box-shadow 180ms ease"
      _hover={{ transform: "translateY(-2px)" }}
    >
      {/* Image */}
      <Box position="relative">
        <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />
        <Box position="absolute" top="10px" right="10px">
          <StatusBadge />
        </Box>
        <Flex position="absolute" bottom="10px" right="10px" gap="8px">
          <IconButton label="Preview listing" onClick={(event) => stopAndRun(event, onPreview)}>
            <IconPreview />
          </IconButton>
          <IconButton label="Edit listing" onClick={(event) => stopAndRun(event, onEdit)}>
            <IconEdit />
          </IconButton>
          {isShareable && (
            <IconButton label={copied ? "Copied link" : "Share listing"} onClick={(event) => stopAndRun(event, shareListing)}>
              <IconShare />
            </IconButton>
          )}
        </Flex>
      </Box>

      {/* Content */}
      <Box p="16px">
        <Flex align="baseline" justify="space-between" gap="8px" mb="4px">
          <Text
            fontFamily={FONT}
            fontSize="15px"
            fontWeight="600"
            color={TEXT}
            letterSpacing="-0.2px"
            flex={1}
            minW={0}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {listing.title}
          </Text>
          <Text fontFamily={FONT} fontSize="15px" fontWeight="700" color={TEXT} letterSpacing="-0.3px" flexShrink={0}>
            {fmt(listing.price)}
          </Text>
        </Flex>

        <Text
          fontFamily={FONT}
          fontSize="13px"
          color={MUTED}
          lineHeight="1.5"
          mb="12px"
          overflow="hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}
        >
          {listing.description || "No description yet."}
        </Text>

        <Flex align="center" justify="space-between" mb={listing.bunqTabUrl ? "12px" : 0}>
          <Text fontFamily={FONT} fontSize="12px" color={MUTED}>
            {listing.stock} in stock · {listing.createdAt}
          </Text>
        </Flex>

        {listing.bunqTabUrl && (
          <BunqQrPanel
            url={buyerCheckoutUrl(listing.slug)}
            price={listing.price}
            bunqUrl={listing.bunqTabUrl}
          />
        )}
      </Box>
    </GlassCard>
  );
}
