import { useState } from "react";
import { Box, Flex, Grid, Text, Textarea } from "@chakra-ui/react";
import { api, centsFromEuros, type DropState } from "../api";
import { DARK, INK_FG, CARD, SURFACE, BORDER, TEXT, MUTED, FONT } from "../theme/tokens";
import { BunqQrPanel } from "./BunqQrPanel";
import type { Listing } from "./ListingCard";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="6px">
        {label}
      </Text>
      {children}
    </Box>
  );
}

const inputStyle = {
  fontFamily: FONT,
  fontSize: "14px",
  color: TEXT,
  bg: CARD,
  border: "1px solid",
  borderColor: BORDER,
  borderRadius: "8px",
  px: "12px",
  py: "10px",
  h: "42px",
  w: "full",
  outline: "none",
  _focus: { borderColor: DARK, boxShadow: "none", outline: "none" },
  _focusVisible: { borderColor: DARK, boxShadow: "none", outline: "none" },
} as const;

function stateLabel(state: DropState | undefined): string {
  switch (state) {
    case "live":           return "Live";
    case "partially_sold": return "Selling";
    case "sold_out":       return "Sold out";
    case "paused":         return "Paused";
    case "review":
    case "processing":     return "In review";
    case "expired":        return "Expired";
    case "archived":       return "Archived";
    default:               return "Draft";
  }
}

export function EditModal({ listing, onClose, onSave, onArchive }: {
  listing: Listing;
  onClose: () => void;
  onSave: (u: Partial<Listing>) => void;
  onArchive: () => void;
}) {
  const [title, setTitle]      = useState(listing.title);
  const [description, setDesc] = useState(listing.description);
  const [price, setPrice]      = useState(listing.price);
  const [stock, setStock]      = useState(listing.stock);
  const [saving, setSaving]    = useState(false);
  const [acting, setActing]    = useState(false);
  const [error, setError]      = useState("");

  const state = listing.state;

  const handleSave = async () => {
    setSaving(true); setError("");
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

  const runAction = async (fn: () => Promise<unknown>, update: Partial<Listing>) => {
    setActing(true); setError("");
    try {
      await fn();
      onSave(update);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  const handleArchive = async () => {
    setActing(true); setError("");
    try {
      await api.archive(listing.id);
      onArchive();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
      setActing(false);
    }
  };

  const busy = saving || acting;

  // Primary action based on current state
  type Action = { label: string; fn: () => void } | null;
  const primaryAction: Action =
    state === "draft"
      ? { label: "Submit for review", fn: () => runAction(() => api.moveToReview(listing.id), { state: "review", status: "draft" }) }
    : state === "review"
      ? { label: "Publish now", fn: () => runAction(() => api.publish(listing.id), { state: "live", status: "live" }) }
    : state === "live" || state === "partially_sold"
      ? { label: "Pause drop", fn: () => runAction(() => api.pause(listing.id), { state: "paused", status: "draft" }) }
    : state === "paused"
      ? { label: "Resume drop", fn: () => runAction(() => api.resume(listing.id), { state: "live", status: "live" }) }
    : null;

  return (
    <Flex
      align="center"
      bg="rgba(0,0,0,0.5)"
      bottom={0} left={0} right={0} top={0}
      justify="center"
      p={{ base: 3, md: 6 }}
      position="fixed"
      zIndex={40}
      onClick={onClose}
      style={{ backdropFilter: "blur(4px)" }}
    >
      <Box
        bg={CARD}
        border="1px solid"
        borderColor={BORDER}
        boxShadow="0 8px 40px rgba(0,0,0,0.18)"
        borderRadius="16px"
        maxW="500px"
        w="full"
        onClick={((e: React.MouseEvent) => e.stopPropagation()) as any}
        maxH="calc(100dvh - 32px)"
        overflow="auto"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px="24px"
          py="20px"
          borderBottom="1px solid"
          borderColor={BORDER}
          gap="12px"
        >
          <Box flex={1} minW={0}>
            <Text fontFamily={FONT} fontSize="11px" fontWeight="600" color={MUTED} textTransform="uppercase" letterSpacing="0.06em" mb="2px">
              {stateLabel(state)} · Edit listing
            </Text>
            <Text fontFamily={FONT} fontSize="17px" fontWeight="600" color={TEXT} letterSpacing="-0.3px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {listing.title}
            </Text>
          </Box>
          <Box
            as="button"
            onClick={onClose}
            flexShrink={0}
            w="32px" h="32px"
            borderRadius="50%"
            bg={SURFACE}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            _hover={{ bg: BORDER }}
            border="none"
            fontFamily={FONT}
            fontSize="16px"
            color={MUTED}
          >
            ×
          </Box>
        </Flex>

        {/* Body */}
        <Box p="24px">
          {listing.bunqTabUrl && (
            <Box mb="20px">
              <BunqQrPanel url={listing.bunqTabUrl} price={listing.price} />
            </Box>
          )}

          <Box display="flex" flexDirection="column" gap="16px">
            <Field label="Title">
              <Box
                as="input"
                {...inputStyle as any}
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              />
            </Field>

            <Grid templateColumns="1fr 1fr" gap="12px">
              <Field label="Price (EUR)">
                <Box
                  as="input"
                  {...inputStyle as any}
                  value={price}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                />
              </Field>
              <Field label="Stock">
                <Box
                  as="input"
                  type="number"
                  min={0}
                  {...inputStyle as any}
                  value={stock}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStock(Math.max(0, Number(e.target.value)))}
                />
              </Field>
            </Grid>

            <Field label="Description">
              <Textarea
                {...inputStyle as any}
                h="auto"
                minH="90px"
                py="10px"
                resize="vertical"
                value={description}
                onChange={(e) => setDesc(e.target.value)}
              />
            </Field>
          </Box>

          {error && (
            <Text fontFamily={FONT} fontSize="13px" color="red.500" mt="12px">{error}</Text>
          )}

          {/* Save */}
          <Box
            as="button"
            w="full"
            h="44px"
            mt="20px"
            bg={DARK}
            color={INK_FG}
            borderRadius="8px"
            fontFamily={FONT}
            fontSize="14px"
            fontWeight="600"
            cursor={busy ? "not-allowed" : "pointer"}
            opacity={busy ? 0.7 : 1}
            border="none"
            _hover={{ opacity: busy ? 0.7 : 0.9 }}
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={busy ? undefined : handleSave}
          >
            {saving ? "Saving…" : "Save changes"}
          </Box>

          {/* State transitions */}
          {(primaryAction || state !== "archived") && (
            <Box mt="12px" display="flex" flexDirection="column" gap="8px">
              {primaryAction && (
                <Box
                  as="button"
                  w="full"
                  h="40px"
                  bg={SURFACE}
                  color={TEXT}
                  borderRadius="8px"
                  fontFamily={FONT}
                  fontSize="13px"
                  fontWeight="600"
                  cursor={busy ? "not-allowed" : "pointer"}
                  opacity={busy ? 0.6 : 1}
                  border="1px solid"
                  borderColor={BORDER}
                  _hover={{ bg: BORDER }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  onClick={busy ? undefined : primaryAction.fn}
                >
                  {acting ? "Working…" : primaryAction.label}
                </Box>
              )}
              {state !== "archived" && (
                <Box
                  as="button"
                  w="full"
                  h="36px"
                  bg="transparent"
                  color={MUTED}
                  borderRadius="8px"
                  fontFamily={FONT}
                  fontSize="12px"
                  fontWeight="500"
                  cursor={busy ? "not-allowed" : "pointer"}
                  opacity={busy ? 0.5 : 1}
                  border="none"
                  _hover={{ color: "red.500" }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  onClick={busy ? undefined : handleArchive}
                >
                  {acting ? "Working…" : "Archive listing"}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
