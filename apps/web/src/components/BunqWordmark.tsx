import { Box, HStack, Text } from "@chakra-ui/react";
import { G, FONT } from "../theme/tokens";

export function BunqWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <HStack gap="8px" userSelect="none">
      <Box
        bg={G}
        borderRadius="6px"
        h="28px"
        w="28px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Text fontFamily={FONT} fontWeight="700" color="black" fontSize="15px" lineHeight={1}>b</Text>
      </Box>
      <Text fontFamily={FONT} fontWeight="600" fontSize="15px" letterSpacing="-0.3px" color="inherit">
        {subtitle ? `bunq ${subtitle}` : "bunq"}
      </Text>
    </HStack>
  );
}
