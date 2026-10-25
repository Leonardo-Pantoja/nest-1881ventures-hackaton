import sharp from "sharp";
import { ProductAIError } from "./gemini";

export async function prepareProductImage(file: File) {
  try {
    // Decode and normalize real image contents; cap decompressed pixels as well as upload bytes.
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "warning", animated: false });
    const metadata = await input.metadata();
    const expected = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[file.type];
    if (!expected || metadata.format !== expected) throw new Error("Invalid format");
    const bytes = await input.rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { bytes, mimeType: "image/jpeg", originalBytes: file.size };
  } catch {
    throw new ProductAIError("invalid_image", "No se pudo leer la imagen. Usa un JPG, PNG o WebP válido de hasta 40 megapíxeles.", 400);
  }
}
