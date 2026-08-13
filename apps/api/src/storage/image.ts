import sharp from "sharp";

/** Max output edge so prize images stay light on the public spin page. */
const MAX_EDGE = 1200;
const WEBP_QUALITY = 82;

export async function convertPrizeImageToWebp(input: Buffer): Promise<Buffer> {
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
