import "server-only";
import { prisma } from "./prisma";
import { destroyManagedCloudAsset, ownsAvatarId, ownsImageId } from "./cloudinary";
import { operationalError } from "./operations-log";

const MAX_ATTEMPTS = 5;
export type CleanupSummary = { processed: number; succeeded: number; failed: number; skipped: number };

export async function processCloudCleanupJobs(now = new Date(), limit = 25): Promise<CleanupSummary> {
  const jobs = await prisma.cloudAssetCleanupJob.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now } }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: Math.min(Math.max(limit, 1), 100) });
  const summary: CleanupSummary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    const claimed = await prisma.cloudAssetCleanupJob.updateMany({ where: { id: job.id, status: "PENDING", attempts: job.attempts }, data: { attempts: { increment: 1 }, attemptedAt: now, nextAttemptAt: new Date(now.getTime() + 15 * 60_000) } });
    if (!claimed.count) { summary.skipped++; continue; }
    summary.processed++;
    const valid = job.kind === "PRODUCT" ? ownsImageId(job.publicId, job.ownerId) : ownsAvatarId(job.publicId, job.ownerId);
    const referenced = job.kind === "PRODUCT"
      ? await prisma.product.count({ where: { imagePublicId: job.publicId } })
      : await prisma.user.count({ where: { imagePublicId: job.publicId } });
    if (!valid || referenced) {
      await prisma.cloudAssetCleanupJob.update({ where: { id: job.id }, data: { status: "FAILED", lastErrorCode: valid ? "still-referenced" : "unmanaged-id" } });
      summary.failed++;
      continue;
    }
    if (await destroyManagedCloudAsset(job.ownerId, job.publicId, job.kind)) {
      await prisma.cloudAssetCleanupJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: new Date(), lastErrorCode: null } });
      summary.succeeded++;
      continue;
    }
    const terminal = job.attempts + 1 >= MAX_ATTEMPTS;
    await prisma.cloudAssetCleanupJob.update({ where: { id: job.id }, data: { status: terminal ? "FAILED" : "PENDING", nextAttemptAt: new Date(now.getTime() + Math.min(24, 2 ** job.attempts) * 60 * 60_000), lastErrorCode: "provider-unavailable" } });
    if (terminal) summary.failed++;
    operationalError("cloud-cleanup-attempt-failed", { jobId: job.id, attempt: job.attempts + 1, terminal });
  }
  return summary;
}
