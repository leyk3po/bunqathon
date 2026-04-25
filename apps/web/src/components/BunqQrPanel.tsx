import { Box, Flex, QrCode, Text } from "@chakra-ui/react";
import { PANEL, G, FONT } from "../theme/tokens";

function fmt(price: string) {
  const n = Number(price);
  return `€ ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export function BunqQrPanel({ url, price }: { url: string; price: string }) {
  return (
    <Flex
      bg={PANEL}
      borderRadius="10px"
      align="center"
      gap="14px"
      p="12px"
    >
      <QrCode.Root
        bg="white"
        color="#111111"
        border="1px solid"
        borderColor="rgba(17,17,17,0.14)"
        borderRadius="8px"
        boxShadow="0 10px 24px rgba(0,0,0,0.18)"
        p="6px"
        size="sm"
        value={url}
        flexShrink={0}
      >
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
      </QrCode.Root>
      <Box minW={0}>
        <Text
          fontFamily={FONT}
          fontSize="10px"
          fontWeight="600"
          color={G}
          textTransform="uppercase"
          letterSpacing="0.06em"
          mb="2px"
        >
          bunq pay
        </Text>
        <Text fontFamily={FONT} fontSize="20px" fontWeight="700" color="white" letterSpacing="-0.5px">
          {fmt(price)}
        </Text>
        <Text fontFamily={FONT} fontSize="11px" color="whiteAlpha.500" mt="1px">Scan to pay</Text>
      </Box>
    </Flex>
  );
}
