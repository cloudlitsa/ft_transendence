// Shared friendship lookups. Used by the alerts routes (both the GET
// listing and the WebSocket broadcast) so the two can't drift apart on
// who counts as a friend.
import { prisma } from "../prisma.js";

export async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ userIdA: userId }, { userIdB: userId }],
    },
    select: { userIdA: true, userIdB: true },
  });

  return friendships.map((f) => (f.userIdA === userId ? f.userIdB : f.userIdA));
}