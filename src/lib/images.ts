export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_UPLOAD_ERROR = "We couldn't upload this photo. Please try again.";

export function imageFileError(file: { type: string; size: number }) {
  if (!IMAGE_TYPES.some(type => type === file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Photo must be smaller than 5 MB.";
  if (file.size === 0) return "This photo is empty. Choose another image.";
  return null;
}

export function matchesImageContent(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export function isAllowedImageUrl(value: string) {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    if (/\.(svg|gif|html?)$/i.test(url.pathname)) return false;
    return (url.hostname === "res.cloudinary.com" && /^\/[\w-]+\/image\/upload\//.test(url.pathname)) ||
      (url.hostname === "images.unsplash.com" && url.pathname.startsWith("/photo-"));
  } catch { return false; }
}
