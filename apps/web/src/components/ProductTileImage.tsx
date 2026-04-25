import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { BUNQ_DARK, BUNQ_GREEN } from "../theme/tokens";

export function ProductTileImage({ imageUrl, title }: { imageUrl?: string; title: string }) {
  if (imageUrl) {
    return <Image alt={title} borderRadius="20px" h="210px" objectFit="cover" src={imageUrl} w="full" />;
  }
  return (
    <Flex
      align="center"
      bg={`linear-gradient(135deg, ${BUNQ_DARK} 0%, #1a3a2a 50%, #0a4a20 100%)`}
      borderRadius="20px"
      color="white"
      h="210px"
      justify="center"
      overflow="hidden"
      position="relative"
    >
      <Box bg="white" borderRadius="10px 10px 20px 20px" h="100px" position="relative" w="86px">
        <Box
          border="7px solid white"
          borderBottom="0"
          borderRadius="999px 999px 0 0"
          h="44px"
          left="50%"
          position="absolute"
          top="-33px"
          transform="translateX(-50%)"
          w="52px"
        />
        <Box
          bg={BUNQ_GREEN}
          borderRadius="999px"
          boxShadow="0 0 0 10px rgba(0,213,75,0.2)"
          h="16px"
          left="50%"
          position="absolute"
          top="48%"
          transform="translate(-50%, -50%)"
          w="16px"
        />
      </Box>
      <Text bottom="14px" fontWeight="black" left="16px" position="absolute" fontSize="sm">{title}</Text>
    </Flex>
  );
}
