/** Max output edge so prize images stay light on the public spin page. */
const MAX_EDGE = 1200;
const WEBP_QUALITY = 82;

/** Lazy-load sharp so a missing native binary cannot crash API boot /health. */
export async function convertPrizeImageToWebp(input: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
