import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { PANEL, G, FONT } from "../theme/tokens";

export function ProductTileImage({ imageUrl, title }: { imageUrl?: string; title: string }) {
  if (imageUrl) {
    return (
      <Image
        alt={title}
        borderRadius="8px"
        h="200px"
        objectFit="cover"
        src={imageUrl}
        w="full"
        display="block"
      />
    );
  }
  return (
    <Flex
      align="center"
      bg={PANEL}
      borderRadius="8px"
      color="white"
      h="200px"
      justify="center"
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.06}
        backgroundImage="linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)"
        backgroundSize="32px 32px"
      />
      <Box position="relative" zIndex={1} textAlign="center">
        <Box
          w="40px" h="40px" borderRadius="50%"
          bg={G}
          mx="auto"
          mb="10px"
          opacity={0.9}
        />
        <Text fontFamily={FONT} fontSize="12px" fontWeight="500" color="whiteAlpha.500">
          {title}
        </Text>
      </Box>
    </Flex>
  );
}
