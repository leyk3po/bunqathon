import { Box, HStack } from "@chakra-ui/react";
import { BUNQ_GREEN } from "../theme/tokens";

const BAR_HEIGHTS = [28, 42, 52, 36, 60, 44, 30, 56, 40, 24, 48, 38, 54, 32];

export function VoiceWave({ active }: { active: boolean }) {
  return (
    <HStack gap="3px" h="64px" align="center" justify="center" w="full">
      {BAR_HEIGHTS.map((h, i) => (
        <Box
          key={i}
          className={active ? "voice-bar" : undefined}
          bg={active ? BUNQ_GREEN : "gray.200"}
          borderRadius="full"
          w="4px"
          h={active ? `${h}px` : "6px"}
          transition={active ? undefined : "height 300ms ease, background 300ms ease"}
          style={
            active
              ? { animationDelay: `${(i * 0.05).toFixed(2)}s`, animationDuration: `${0.55 + (i % 5) * 0.08}s` }
              : undefined
          }
        />
      ))}
    </HStack>
  );
}
