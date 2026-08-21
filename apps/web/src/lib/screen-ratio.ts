export type ScreenRatio = "auto" | "9:16" | "16:9";

export function spinFrameClass(ratio: ScreenRatio | undefined): string {
  switch (ratio) {
    case "9:16":
      return "spin-frame-9-16";
    case "16:9":
      return "spin-frame-16-9";
    default:
      return "spin-frame-auto";
  }
}

export function spinShellClass(ratio: ScreenRatio | undefined): string {
  const base = "h-dvh max-h-dvh w-full overflow-hidden";
  if (ratio === "9:16" || ratio === "16:9") {
    return base;
  }
  return `${base} spin-page-bg`;
}

export function spinPageWrapperClass(isFixedRatio: boolean): string {
  return isFixedRatio ? "" : "flex items-center justify-center px-0 sm:px-4 portrait:px-0";
}
