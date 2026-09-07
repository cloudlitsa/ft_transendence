// The trust boundary for everything hanging off an alert.
//
// Shared by the message routes and the attachment routes, so the two cannot
// drift apart on who is allowed to see a conversation. Chat messages and the
// images inside them have exactly one audience rule between them.

import { prisma } from "../prisma.js";

/**
 * May `me` read and post in this alert's conversation?
 *
 * Access is granted when the alert exists AND either:
 *
 *     - `me` is the alert's sender, or
 *     - `me` is an accepted friend of the sender
 *
 * The alert's status is deliberately not checked: closing an alert stops
 * acknowledgements, not the conversation.
 *
 * Returns the sender's id on success, because callers need it to work out the
 * broadcast audience. Returns null for every kind of refusal — and callers
 * turn all of them into the SAME 404, whether the alert doesn't exist, isn't
 * yours, or belongs to a stranger. Distinguishable answers would let someone
 * probe for which alert ids are real.
 */
export async function canAccessAlert(alertId: string, me: string): Promise<string | null> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { senderId: true },
  });
  if (!alert) return null;

  if (alert.senderId === me) return alert.senderId;

  // A friendship is stored as ONE row per pair, with the smaller UUID always
  // in user_id_a (see DATA-MODEL.md). So the two ids get sorted before the
  // lookup — without this, roughly half of all lookups would miss a
  // friendship that genuinely exists.
  const [a, b] = me < alert.senderId ? [me, alert.senderId] : [alert.senderId, me];
  const friendship = await prisma.friendship.findUnique({
    where: { userIdA_userIdB: { userIdA: a, userIdB: b } },
    select: { status: true },
  });
  // Pending and blocked are both "no". Only accepted grants access.
  if (!friendship || friendship.status !== "accepted") return null;

  return alert.senderId;
}
