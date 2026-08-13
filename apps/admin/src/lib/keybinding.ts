export const SPIN_KEY_PRESETS = [
  { code: "", label: "None" },
  { code: "Space", label: "Space" },
  { code: "Enter", label: "Enter" },
  { code: "KeyS", label: "S" },
  { code: "KeyG", label: "G" },
  { code: "Digit1", label: "1" },
] as const;

export function formatKeybinding(code: string | null | undefined): string {
  if (!code) return "None";
  if (code === "Space") return "Space";
  if (code === "Enter") return "Enter";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}
