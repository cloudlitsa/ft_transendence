// The trust boundary for everything hanging off an alert.
//
// Shared by the message routes and the attachment routes, so the two cannot
// drift apart on who is allowed to see a conversation. Chat messages and the
// images inside them have exactly one audience rule between them.

import type { AlertStatus } from "@prisma/client";
import { prisma } from "../prisma.js";

export type AlertAccess = {
  /** Callers need this to work out a broadcast audience. */
  senderId: string;
  /** The Prisma enum, so a typo in a comparison fails to compile. */
  status: AlertStatus;
};

/**
 * May `me` see this alert's conversation? Yes if the alert exists and `me` is
 * its sender or an accepted friend of the sender.
 *
 * Visibility only. Status is reported, not enforced — a closed conversation is
 * still readable, so only POST /messages acts on it. Enforcing it here would
 * take the history down with the composer.
 *
 * Returns null for every refusal, and callers turn all of them into the same
 * 404: distinguishable answers would let someone probe which alert ids exist.
 */
export async function canAccessAlert(alertId: string, me: string): Promise<AlertAccess | null> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { senderId: true, status: true },
  });
  if (!alert) return null;

  if (alert.senderId === me) return alert;

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

  return alert;
}
