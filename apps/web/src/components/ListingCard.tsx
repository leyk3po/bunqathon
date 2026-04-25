import { useEffect } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { api, eurosFromCents } from "../api";
import { G, CARD, BORDER, TEXT, MUTED, FONT } from "../theme/tokens";
import { ProductTileImage } from "./ProductTileImage";
import { BunqQrPanel } from "./BunqQrPanel";
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
  createdAt: string;
  audioUrl?: string;
  bunqTabUrl?: string | null;
};

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
        const newStock = (data.inventory ?? listing.stock) - (data.sold_count ?? 0);
        onUpdate({ stock: Math.max(0, newStock) });
        onCelebrate({
          title: listing.title,
          amount: fmt(eurosFromCents(data.amount_cents ?? Math.round(Number(listing.price) * 100))),
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("state_changed", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string);
        if (data.state === "sold_out") onUpdate({ status: "sold", stock: 0 });
        else if (data.inventory != null) onUpdate({ stock: data.inventory - (data.sold_count ?? 0) });
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [listing.slug, listing.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLive = listing.status === "live";
  const isSold = listing.status === "sold";

  return (
    <Box
      bg={CARD}
      border="1px solid"
      borderColor={BORDER}
      borderRadius="12px"
      overflow="hidden"
      cursor="pointer"
      onClick={onEdit}
      _hover={{ borderColor: "var(--c-muted)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
      transition="all 180ms ease"
    >
      {/* Image */}
      <Box position="relative">
        <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />
        <Box position="absolute" top="10px" right="10px">
          {isLive ? (
            <Flex align="center" gap="5px" bg="white" borderRadius="20px" px="8px" py="4px" boxShadow="0 1px 4px rgba(0,0,0,0.12)">
              <Box
                bg={G}
                borderRadius="full"
                h="7px"
                w="7px"
                flexShrink={0}
                position="relative"
                className="live-pulse"
              />
              <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="black">Live</Text>
            </Flex>
          ) : isSold ? (
            <Box bg="#0a0a0a" borderRadius="20px" px="8px" py="4px">
              <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color="white">Sold out</Text>
            </Box>
          ) : (
            <Box bg="rgba(0,0,0,0.5)" borderRadius="20px" px="8px" py="4px">
              <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="white">Draft</Text>
            </Box>
          )}
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

        {listing.bunqTabUrl && <BunqQrPanel url={listing.bunqTabUrl} price={listing.price} />}
      </Box>
    </Box>
  );
}
