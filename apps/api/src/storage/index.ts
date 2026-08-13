import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasSupabaseStorage, env } from "../env.js";

const UPLOAD_ROOT = join(process.cwd(), "uploads");

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

function storageBaseUrl(): string {
  return `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  if (hasSupabaseStorage()) {
    const baseUrl = storageBaseUrl();
    await fetch(`${baseUrl}/object/${bucket}/${path}`, {
      method: "DELETE",
      headers: supabaseHeaders(),
    }).catch(() => undefined);

    const response = await fetch(`${baseUrl}/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: data,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Storage upload failed (${response.status})`);
    }

    return `${baseUrl}/object/public/${bucket}/${path}`;
  }

  const localPath = join(UPLOAD_ROOT, bucket, path);
  await mkdir(join(localPath, ".."), { recursive: true });
  await writeFile(localPath, data);
  return `/uploads/${bucket}/${path}`;
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};
