import { Box, Text } from "ink";
import type { AppState } from "../types.js";

interface ToastProps {
  message: string;
  tone: AppState["toastTone"];
}

const TONE_COLORS: Record<AppState["toastTone"], string> = {
  success: "green",
  info: "cyan",
  error: "red",
};

const TONE_GLYPHS: Record<AppState["toastTone"], string> = {
  success: "✓",
  info: "ℹ",
  error: "✗",
};

export const Toast = ({ message, tone }: ToastProps) => (
  <Box paddingX={1}>
    <Text color={TONE_COLORS[tone]} bold>
      {TONE_GLYPHS[tone]}{" "}
    </Text>
    <Text color="white">{message}</Text>
  </Box>
);
