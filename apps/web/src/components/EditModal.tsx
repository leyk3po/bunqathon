import { useState } from "react";
import { Badge, Box, Button, Card, Flex, Heading, HStack, Input, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { api, centsFromEuros } from "../api";
import { BUNQ_GREEN } from "../theme/tokens";
import { BunqQrPanel } from "./BunqQrPanel";
import type { Listing } from "./ListingCard";

export function EditModal({
  listing,
  onClose,
  onSave,
}: {
  listing: Listing;
  onClose: () => void;
  onSave: (u: Partial<Listing>) => void;
}) {
  const [title, setTitle]      = useState(listing.title);
  const [description, setDesc] = useState(listing.description);
  const [price, setPrice]      = useState(listing.price);
  const [stock, setStock]      = useState(listing.stock);
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateDrop(listing.id, {
        title: title.trim() || listing.title,
        description: description.trim(),
        price_cents: centsFromEuros(price),
        inventory: Math.max(0, stock),
      });
      onSave({ title, description, price, stock });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex
      align="center"
      bg="blackAlpha.700"
      bottom={0}
      justify="center"
      left={0}
      p={{ base: 3, md: 6 }}
      position="fixed"
      right={0}
      top={0}
      zIndex={40}
      onClick={onClose}
    >
      <Card.Root borderRadius="28px" maxW="560px" w="full" onClick={(e) => e.stopPropagation()}>
        <Card.Body p={6}>
          <Flex align="center" justify="space-between" mb={5}>
            <Box>
              <Badge bg={BUNQ_GREEN} color="black" fontWeight="bold" borderRadius="8px" px={2} mb={2}>Edit listing</Badge>
              <Heading size="lg">{listing.title}</Heading>
            </Box>
            <Button colorPalette="gray" onClick={onClose} variant="ghost" size="sm">✕</Button>
          </Flex>

          {listing.bunqTabUrl && (
            <Box mb={5}>
              <BunqQrPanel url={listing.bunqTabUrl} price={listing.price} />
            </Box>
          )}

          <Stack gap={3}>
            <Box>
              <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Title</Text>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} borderRadius="12px" />
            </Box>
            <SimpleGrid columns={2} gap={3}>
              <Box>
                <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Price (EUR)</Text>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} borderRadius="12px" />
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Stock</Text>
                <Input type="number" min={0} value={stock} onChange={(e) => setStock(Math.max(0, Number(e.target.value)))} borderRadius="12px" />
              </Box>
            </SimpleGrid>
            <Box>
              <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500" textTransform="uppercase" letterSpacing="0.05em">Description</Text>
              <Textarea value={description} onChange={(e) => setDesc(e.target.value)} minH="100px" borderRadius="12px" />
            </Box>
          </Stack>

          {error && <Text color="red.500" fontSize="sm" mt={2}>{error}</Text>}

          <HStack mt={5} gap={3}>
            <Button
              flex={1}
              borderRadius="14px"
              bg={BUNQ_GREEN}
              color="black"
              fontWeight="bold"
              loading={saving}
              onClick={handleSave}
              size="lg"
              _hover={{ bg: "#00c044" }}
            >
              Save changes
            </Button>
            <Button flex={0} borderRadius="14px" variant="outline" onClick={onClose} size="lg">
              Cancel
            </Button>
          </HStack>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
}
