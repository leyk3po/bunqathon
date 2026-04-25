import { useEffect } from "react";
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
  onEdit,
  onCelebrate,
}: {
  listing: Listing;
  onUpdate: (u: Partial<Listing>) => void;
  onEdit: () => void;
  onCelebrate: (d: CelebrationData) => void;
}) {
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
      onClick={onEdit}
      transition="transform 180ms ease, box-shadow 180ms ease"
      _hover={{ transform: "translateY(-2px)" }}
    >
      {/* Image */}
      <Box position="relative">
        <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />
        <Box position="absolute" top="10px" right="10px">
          <StatusBadge />
        </Box>
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
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
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
