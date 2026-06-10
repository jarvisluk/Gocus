export type CopyTextResult = "bridge" | "clipboard";

export interface CopyTextBridge {
  copyText?: (text: string) => Promise<void> | void;
}

export interface ClipboardWriter {
  writeText?: (text: string) => Promise<void> | void;
}

export function copyTextTarget({
  bridge,
  clipboard,
}: {
  bridge?: CopyTextBridge | null;
  clipboard?: ClipboardWriter | null;
}): CopyTextResult | "unavailable" {
  if (bridge?.copyText) return "bridge";
  if (clipboard?.writeText) return "clipboard";
  return "unavailable";
}

export async function copyTextWithFallback(
  text: string,
  {
    bridge,
    clipboard,
  }: {
    bridge?: CopyTextBridge | null;
    clipboard?: ClipboardWriter | null;
  },
): Promise<CopyTextResult> {
  const copyText = bridge?.copyText;
  const writeText = clipboard?.writeText;

  if (copyText) {
    try {
      await copyText(text);
      return "bridge";
    } catch (error) {
      if (!writeText) throw error;
    }
  }

  if (writeText) {
    await writeText(text);
    return "clipboard";
  }

  throw new Error("Clipboard is unavailable.");
}
