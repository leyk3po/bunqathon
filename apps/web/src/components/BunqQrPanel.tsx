import { Badge, Box, Flex, Heading, QrCode, Text } from "@chakra-ui/react";
import { BUNQ_DARK, BUNQ_GREEN } from "../theme/tokens";

function formatPrice(price: string) {
  const n = Number(price);
  return `€ ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export function BunqQrPanel({ url, price }: { url: string; price: string }) {
  return (
    <Flex bg={BUNQ_DARK} borderRadius="20px" color="white" gap={4} p={4} align="center">
      <QrCode.Root bg="white" borderRadius="14px" p="6px" size="md" value={url}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
      </QrCode.Root>
      <Box>
        <Badge bg={BUNQ_GREEN} color="black" fontWeight="bold" mb={1} px={2} borderRadius="8px" fontSize="xs">
          bunq pay
        </Badge>
        <Heading size="xl" color="white">{formatPrice(price)}</Heading>
        <Text color="whiteAlpha.600" fontSize="xs" mt={1}>Scan to pay instantly</Text>
      </Box>
    </Flex>
  );
}
