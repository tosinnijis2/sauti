import { prisma } from "./prisma";

export class InteractionError extends Error {}

export async function interactionBlockState(viewerId: string, otherId: string) {
  const blocks = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId, blockedId: otherId }, { blockerId: otherId, blockedId: viewerId }] }, select: { blockerId: true } });
  return { blocked: blocks.length > 0, viewerBlocked: blocks.some(block => block.blockerId === viewerId) };
}

export async function isInteractionBlocked(firstUserId: string, secondUserId: string, client: Pick<typeof prisma, "userBlock"> = prisma) {
  return Boolean(await client.userBlock.findFirst({ where: { OR: [{ blockerId: firstUserId, blockedId: secondUserId }, { blockerId: secondUserId, blockedId: firstUserId }] }, select: { blockerId: true } }));
}

export async function blockInteraction(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new InteractionError("You cannot block yourself.");
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw new InteractionError("Account not found.");
  const existing = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
  if (existing) throw new InteractionError("This account is already blocked.");
  return prisma.userBlock.create({ data: { blockerId, blockedId } });
}

export async function unblockInteraction(blockerId: string, blockedId: string) {
  const result = await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  if (!result.count) throw new InteractionError("Block not found.");
}
