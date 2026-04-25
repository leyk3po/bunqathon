import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { PANEL, FONT } from "../theme/tokens";

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
      h="200px"
      justify="center"
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.05}
        backgroundImage="linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)"
        backgroundSize="32px 32px"
      />
      <Box position="relative" zIndex={1} textAlign="center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }}>
          <path d="M8.25 6.75 9.7 5h4.6l1.45 1.75H19A2.25 2.25 0 0 1 21.25 9v7A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V9A2.25 2.25 0 0 1 5 6.75h3.25Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.25" stroke="white" strokeWidth="1.5" />
        </svg>
        <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="whiteAlpha.400">
          {title}
        </Text>
      </Box>
    </Flex>
  );
}
