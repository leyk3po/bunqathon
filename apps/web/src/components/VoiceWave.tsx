import { Box, Flex, Text } from "@chakra-ui/react";
import { G, BORDER, FONT } from "../theme/tokens";

const BARS = [20, 32, 44, 28, 52, 36, 24, 48, 34, 20, 40, 30, 46, 26];

export function VoiceWave({ active }: { active: boolean }) {
  return (
    <Box>
      <Flex h="52px" align="center" justify="center" gap="3px">
        {BARS.map((h, i) => (
          <Box
            key={i}
            className={active ? "voice-bar" : undefined}
            bg={active ? G : BORDER}
            borderRadius="2px"
            w="3px"
            h={active ? `${h}px` : "4px"}
            transition={active ? undefined : "all 300ms ease"}
            style={active ? {
              animationDelay: `${(i * 0.05).toFixed(2)}s`,
              animationDuration: `${0.55 + (i % 5) * 0.08}s`,
            } : undefined}
          />
        ))}
      </Flex>
      {active && (
        <Text
          fontFamily={FONT}
          fontSize="11px"
          fontWeight="500"
          color={G}
          textAlign="center"
          mt="8px"
          letterSpacing="0.02em"
        >
          Recording…
        </Text>
      )}
    </Box>
  );
}
