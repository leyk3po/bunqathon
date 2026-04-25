import { Box, Flex, Text } from "@chakra-ui/react";
import { DARK, BORDER, FONT, MUTED } from "../theme/tokens";

const BARS = [14, 28, 42, 22, 56, 38, 18, 50, 32, 44, 20, 58, 36, 24, 52, 30, 46, 16, 40, 26];

export function VoiceWave({ active }: { active: boolean }) {
  return (
    <Box>
      <Flex h="56px" align="center" justify="center" gap="3px">
        {BARS.map((h, i) => (
          <Box
            key={i}
            className={active ? "voice-bar" : undefined}
            bg={active ? DARK : BORDER}
            borderRadius="3px"
            w={i % 3 === 1 ? "3px" : "2px"}
            h={active ? `${h}px` : "3px"}
            transition={active ? undefined : "all 400ms ease"}
            style={active ? {
              animationDelay: `${(i * 0.055).toFixed(3)}s`,
              animationDuration: `${0.8 + (i % 7) * 0.09}s`,
            } : undefined}
          />
        ))}
      </Flex>
      {active && (
        <Text
          fontFamily={FONT}
          fontSize="11px"
          fontWeight="500"
          color={MUTED}
          textAlign="center"
          mt="6px"
          letterSpacing="0.04em"
        >
          Recording…
        </Text>
      )}
    </Box>
  );
}
