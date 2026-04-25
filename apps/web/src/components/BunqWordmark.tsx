import { Text } from "@chakra-ui/react";
import { FONT, TEXT } from "../theme/tokens";

export function BunqWordmark({ subtitle: _subtitle }: { subtitle?: string } = {}) {
  return (
    <Text
      fontFamily={FONT}
      fontWeight="700"
      fontSize="16px"
      color={TEXT}
      letterSpacing="-0.5px"
      userSelect="none"
      flexShrink={0}
    >
      FlashDrop
    </Text>
  );
}
