import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImageUploadError, uploadProductPhoto } from "@/lib/cloudinary";
import { IMAGE_UPLOAD_ERROR, MAX_IMAGE_BYTES } from "@/lib/images";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const bodyLimit = MAX_IMAGE_BYTES + 65536;

export async function POST(request: NextRequest) {
  const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Invalid origin." }, 403);
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Please sign in to upload a photo." }, 401);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return reply({ error: "Choose a photo to upload." }, 400);
  if (!await consumeRateLimit("product-upload", user.id, 20, 10 * 60_000)) return reply({ error: "Too many upload attempts. Please wait a few minutes." }, 429);
  if (Number(request.headers.get("content-length")) > bodyLimit) return reply({ error: "Photo must be smaller than 5 MB." }, 413);
  try {
    // Bound the actual stream too; Content-Length is not a trusted size limit.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Choose a photo to upload." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) { await reader.cancel(); return reply({ error: "Photo must be smaller than 5 MB." }, 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return reply({ error: "Choose a photo to upload." }, 400);
    const productId = form.get("productId");
    if (productId !== null && (typeof productId !== "string" || productId.length > 100)) return reply({ error: "Listing not found." }, 404);
    const target = productId ? await prisma.product.findFirst({ where: { id: String(productId), ownerId: user.id }, select: { id: true, updatedAt: true } }) : undefined;
    if (productId && !target) return reply({ error: "Listing not found." }, 404);
    return reply(await uploadProductPhoto(file, user.id, target ?? undefined));
  } catch (error) {
    return reply({ error: error instanceof ImageUploadError ? error.message : IMAGE_UPLOAD_ERROR }, 400);
  }
}
