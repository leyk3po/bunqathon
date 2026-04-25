import { useState } from "react";
import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { PANEL, FONT } from "../theme/tokens";

function Placeholder({ title }: { title: string }) {
  return (
    <Flex
      align="center"
      bg={PANEL}
      borderTopRadius="8px"
      borderBottomRadius="0"
      h="200px"
      justify="center"
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute" inset={0} opacity={0.05}
        backgroundImage="linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)"
        backgroundSize="32px 32px"
      />
      <Box position="relative" zIndex={1} textAlign="center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }}>
          <path d="M8.25 6.75 9.7 5h4.6l1.45 1.75H19A2.25 2.25 0 0 1 21.25 9v7A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V9A2.25 2.25 0 0 1 5 6.75h3.25Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.25" stroke="white" strokeWidth="1.5" />
        </svg>
        <Text fontFamily={FONT} fontSize="11px" fontWeight="500" color="whiteAlpha.400">{title}</Text>
      </Box>
    </Flex>
  );
}

export function ProductTileImage({
  imageUrl,
  imageUrls,
  title,
  h = "200px",
}: {
  imageUrl?: string;
  imageUrls?: string[];
  title: string;
  h?: string;
}) {
  const [idx, setIdx] = useState(0);
  const images = imageUrls && imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];

  if (images.length === 0) return <Placeholder title={title} />;

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };

  return (
    <Box position="relative" h={h} overflow="hidden" borderTopRadius="8px">
      <Image
        alt={title}
        h={h}
        w="full"
        objectFit="cover"
        src={images[idx]}
        display="block"
        style={{ transition: "opacity 0.15s ease" }}
      />

      {images.length > 1 && (
        <>
          {/* Prev */}
          <Box
            as="button"
            position="absolute" left="6px" top="50%" transform="translateY(-50%)"
            w="26px" h="26px" borderRadius="50%"
            bg="rgba(0,0,0,0.45)" color="white"
            border="none" cursor="pointer"
            display="flex" alignItems="center" justifyContent="center"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={prev}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 1.5 3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>

          {/* Next */}
          <Box
            as="button"
            position="absolute" right="6px" top="50%" transform="translateY(-50%)"
            w="26px" h="26px" borderRadius="50%"
            bg="rgba(0,0,0,0.45)" color="white"
            border="none" cursor="pointer"
            display="flex" alignItems="center" justifyContent="center"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={next}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 1.5 7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>

          {/* Dot indicators */}
          <Flex
            position="absolute" bottom="8px" left={0} right={0}
            justify="center" gap="4px" pointerEvents="none"
          >
            {images.map((_, i) => (
              <Box
                key={i}
                w={i === idx ? "16px" : "5px"} h="5px"
                borderRadius="3px"
                bg={i === idx ? "white" : "rgba(255,255,255,0.45)"}
                style={{ transition: "width 0.2s ease" }}
              />
            ))}
          </Flex>

          {/* Count badge */}
          <Box
            position="absolute" top="8px" right="8px"
            bg="rgba(0,0,0,0.5)" borderRadius="10px"
            px="6px" py="2px"
            style={{ backdropFilter: "blur(4px)" }}
          >
            <Text fontFamily={FONT} fontSize="10px" fontWeight="600" color="white">
              {idx + 1}/{images.length}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
