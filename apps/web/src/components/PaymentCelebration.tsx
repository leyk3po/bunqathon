import { useEffect } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { G, FONT } from "../theme/tokens";

export type CelebrationData = { title: string; amount: string };

export function PaymentCelebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Flex
      className="payment-celebration"
      position="fixed"
      inset={0}
      zIndex={100}
      bg="rgba(0,0,0,0.6)"
      align="center"
      justify="center"
      pointerEvents="none"
      p={4}
    >
      <Box
        bg="white"
        borderRadius="16px"
        p="40px"
        textAlign="center"
        maxW="340px"
        w="full"
        boxShadow="0 32px 64px rgba(0,0,0,0.24)"
      >
        <Box
          w="56px" h="56px" bg={G} borderRadius="50%"
          mx="auto" mb="20px"
          display="flex" alignItems="center" justifyContent="center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L19 7" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
        <Text fontFamily={FONT} fontSize="20px" fontWeight="700" color="black" letterSpacing="-0.3px">
          Payment received
        </Text>
        <Text fontFamily={FONT} fontSize="28px" fontWeight="700" color="black" mt="8px" letterSpacing="-0.5px">
          {data.amount}
        </Text>
        <Text fontFamily={FONT} fontSize="14px" color="#667085" mt="6px">
          {data.title}
        </Text>
      </Box>
    </Flex>
  );
}
