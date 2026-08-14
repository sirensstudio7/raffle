/** Match admin-stored KeyboardEvent.code values, with Enter/Space fallbacks. */
export function matchesSpinKeybinding(
  event: KeyboardEvent,
  binding: string | null | undefined,
): boolean {
  const code = binding?.trim() ?? "";
  if (!code) return false;
  if (event.code === code) return true;
  if (code === "Enter" && (event.key === "Enter" || event.code === "NumpadEnter")) {
    return true;
  }
  if (code === "Space" && (event.code === "Space" || event.key === " ")) {
    return true;
  }
  return false;
}
