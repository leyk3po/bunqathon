import { useEffect } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import { BUNQ_GREEN } from "../theme/tokens";

export type CelebrationData = { title: string; amount: string };

export function PaymentCelebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Box
      className="payment-celebration"
      position="fixed"
      inset={0}
      zIndex={100}
      bg="rgba(0,0,0,0.75)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
    >
      <Box bg={BUNQ_GREEN} borderRadius="32px" p={10} textAlign="center" maxW="380px" mx={4}>
        <Text fontSize="64px" lineHeight={1}>💚</Text>
        <Heading size="2xl" color="white" mt={4}>Payment received!</Heading>
        <Text color="whiteAlpha.900" fontSize="xl" mt={3} fontWeight="bold">{data.amount}</Text>
        <Text color="whiteAlpha.800" mt={1}>{data.title}</Text>
      </Box>
    </Box>
  );
}
