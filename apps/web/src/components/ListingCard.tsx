import { useEffect } from "react";
import { Badge, Box, Card, Flex, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { api, eurosFromCents } from "../api";
import { BUNQ_GREEN, BUNQ_DARK } from "../theme/tokens";
import { ProductTileImage } from "./ProductTileImage";
import { BunqQrPanel } from "./BunqQrPanel";
import { EditIcon } from "./icons";
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

function formatPrice(price: string) {
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
          amount: formatPrice(eurosFromCents(data.amount_cents ?? Math.round(Number(listing.price) * 100))),
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

  return (
    <Card.Root
      bg="white"
      borderRadius="24px"
      boxShadow="0 8px 32px rgba(0,0,0,0.07)"
      overflow="hidden"
      cursor="pointer"
      onClick={onEdit}
      _hover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "translateY(-2px)" }}
      transition="all 200ms ease"
    >
      <Card.Body p={4}>
        <Box position="relative">
          <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />
          {isLive && (
            <Box position="absolute" top="12px" right="12px">
              <Box
                bg={BUNQ_GREEN}
                borderRadius="full"
                h="12px"
                w="12px"
                position="relative"
                className="live-pulse"
              />
            </Box>
          )}
        </Box>

        <Stack gap={3} mt={4}>
          <Flex align="start" justify="space-between">
            <Box flex={1} minW={0}>
              <Heading size="md" truncate>{listing.title}</Heading>
              <Text color="gray.500" fontSize="xs" mt="2px">{listing.createdAt}</Text>
            </Box>
            <Badge
              bg={isLive ? BUNQ_GREEN : listing.status === "sold" ? "#f87171" : "#e5e7eb"}
              color={isLive ? "black" : listing.status === "sold" ? "white" : "#4b5563"}
              borderRadius="8px"
              px={2}
              ml={2}
              fontSize="xs"
              fontWeight="bold"
              flexShrink={0}
            >
              {isLive ? "live" : listing.status}
            </Badge>
          </Flex>

          <Text color="gray.500" fontSize="sm" lineClamp={2}>{listing.description}</Text>

          <Flex align="center" justify="space-between">
            <Heading size="lg" color={BUNQ_DARK}>{formatPrice(listing.price)}</Heading>
            <Badge bg="#f0fdf4" color="#166534" borderRadius="8px" px={2} fontSize="xs">{listing.stock} left</Badge>
          </Flex>

          {listing.bunqTabUrl ? (
            <BunqQrPanel url={listing.bunqTabUrl} price={listing.price} />
          ) : (
            <Flex align="center" bg="#f9fafb" borderRadius="12px" p={3}>
              <Text color="gray.400" fontSize="xs">Tap to edit listing</Text>
              <Box ml="auto" color="gray.400"><EditIcon /></Box>
            </Flex>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
