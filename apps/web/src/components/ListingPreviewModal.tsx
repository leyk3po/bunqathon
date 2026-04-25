import { Box, Flex, Text } from "@chakra-ui/react";
import { buyerCheckoutUrl } from "../api";
import { BORDER, CARD, FONT, MUTED, TEXT } from "../theme/tokens";
import { BunqQrPanel } from "./BunqQrPanel";
import { ProductTileImage } from "./ProductTileImage";
import type { Listing } from "./ListingCard";

function fmt(price: string) {
  const n = Number(price);
  return `€ ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function stateLabel(listing: Listing) {
  if (listing.state === "live") return "Live preview";
  if (listing.state === "sold_out") return "Sold out";
  if (listing.state === "archived") return "Archived";
  return "Draft preview";
}

export function ListingPreviewModal({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const buyerUrl = buyerCheckoutUrl(listing.slug);
  const isLive = listing.state === "live";

  return (
    <Flex
      align="center"
      bg="rgba(0,0,0,0.5)"
      bottom={0}
      justify="center"
      left={0}
      p={{ base: 3, md: 6 }}
      position="fixed"
      right={0}
      top={0}
      zIndex={40}
      onClick={onClose}
      style={{ backdropFilter: "blur(4px)" }}
    >
      <Box
        bg={CARD}
        border="1px solid"
        borderColor={BORDER}
        borderRadius="16px"
        boxShadow="0 8px 40px rgba(0,0,0,0.18)"
        maxH="calc(100dvh - 32px)"
        maxW="520px"
        overflow="auto"
        w="full"
        onClick={((event: React.MouseEvent) => event.stopPropagation()) as any}
      >
        <Flex align="center" justify="space-between" px="20px" py="16px">
          <Box minW={0}>
            <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em">
              {stateLabel(listing)}
            </Text>
            <Text fontFamily={FONT} fontSize="18px" fontWeight="700" color={TEXT} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {listing.title}
            </Text>
          </Box>
          <Box
            as="button"
            aria-label="Close preview"
            bg="transparent"
            border="none"
            color={MUTED}
            cursor="pointer"
            fontFamily={FONT}
            fontSize="22px"
            h="36px"
            w="36px"
            onClick={onClose}
          >
            ×
          </Box>
        </Flex>

        <Box px="20px" pb="20px">
          <ProductTileImage imageUrl={listing.imageUrl} title={listing.title} />

          <Flex align="baseline" justify="space-between" gap="12px" mt="18px">
            <Text fontFamily={FONT} fontSize="26px" fontWeight="700" color={TEXT}>
              {fmt(listing.price)}
            </Text>
            <Text fontFamily={FONT} fontSize="13px" color={MUTED}>
              {listing.stock} in stock
            </Text>
          </Flex>

          <Text fontFamily={FONT} fontSize="14px" color={MUTED} lineHeight="1.6" mt="12px">
            {listing.description || "No description yet."}
          </Text>

          {isLive && (
            <Box mt="18px">
              <BunqQrPanel url={buyerUrl} price={listing.price} bunqUrl={listing.bunqTabUrl} />
              <Box
                as="a"
                {...{ href: buyerUrl, target: "_blank", rel: "noreferrer" } as any}
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                gap="8px"
                mt="12px"
                w="full"
                h="44px"
                bg={TEXT}
                color={CARD}
                borderRadius="10px"
                fontFamily={FONT}
                fontSize="13px"
                fontWeight="700"
                letterSpacing="0.04em"
                textTransform="uppercase"
                cursor="pointer"
                _hover={{ opacity: 0.85 }}
                transition="opacity 150ms ease"
              >
                Open buyer page <Box as="span">↗</Box>
              </Box>
              <Text fontFamily={FONT} fontSize="11px" color={MUTED} mt="8px" textAlign="center">
                Test the buyer flow — haggle, pay, watch your dashboard update.
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
