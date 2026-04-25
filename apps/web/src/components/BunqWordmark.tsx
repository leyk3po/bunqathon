import { Box, HStack, Text } from "@chakra-ui/react";
import { BUNQ_GREEN } from "../theme/tokens";

export function BunqWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <HStack gap={2}>
      <Box
        bg={BUNQ_GREEN}
        borderRadius="10px"
        h="32px"
        w="32px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Text fontWeight="black" color="black" fontSize="16px" lineHeight={1}>b</Text>
      </Box>
      <Text fontWeight="black" fontSize="lg" letterSpacing="-0.5px">
        {subtitle ? `bunq ${subtitle}` : "bunq"}
      </Text>
    </HStack>
  );
}
