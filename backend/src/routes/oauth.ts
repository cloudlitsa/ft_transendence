// Google OAuth callback. The @fastify/oauth2 plugin (registered in server.ts)
// handles the redirect to Google and the code-for-token exchange. This file
// owns what happens AFTER: fetch the Google profile, then find-or-create the
// user, then issue our own session cookie — the same cookie login issues.
//
// Three account states are possible (see docs/DECISIONS.md):
//   - found by googleId  → returning Google user, log in
//   - found by email     → existing password user linking Google (only if
//                          Google says the email is verified), log in
//   - neither            → brand-new user, create with googleId, log in

import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { signToken, AUTH_COOKIE, cookieOptions } from "../lib/auth.js";

// Shape of the fields we use from Google's userinfo response.
type GoogleProfile = {
  sub: string;            // Google's stable unique id for this account
  email: string;
  email_verified: boolean;
  name?: string;
};

export async function oauthRoutes(fastify: FastifyInstance) {
  fastify.get("/google/callback", async (request, reply) => {
    // 1. Exchange the code (in the request) for an access token.
    const { token } =
      await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    // 2. Use the token to fetch the user's Google profile.
    const profile = (await fastify.googleOAuth2.userinfo(
      token.access_token,
    )) as GoogleProfile;

    const { sub: googleId, email, email_verified, name } = profile;

    // 3. Find-or-create — the three branches.
    let user = await prisma.user.findUnique({
      where: { googleId },
      select: { id: true },
    });

    if (!user) {
      // No googleId match. Is there a password account on this email?
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        // Link — but ONLY if Google vouches the email is verified. Linking on
        // an unverified email would let someone pre-register a password account
        // on an address they don't own, then have it hijacked via Google.
        if (!email_verified) {
          return reply.code(403).send({ error: "Google email not verified" });
        }
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId },
          select: { id: true },
        });
      } else {
        // Brand-new person. Create a Google-only account: googleId set,
        // passwordHash stays null (the schema now allows that).
        user = await prisma.user.create({
          data: {
            email,
            googleId,
            displayName: name ?? email.split("@")[0],
            // no passwordHash — this account logs in via Google only
          },
          select: { id: true },
        });
      }
    }

    // 4. Issue our own session — identical to login. From here the OAuth user
    //    is indistinguishable from a password user.
    const jwt = signToken({ userId: user.id });
    reply.setCookie(AUTH_COOKIE, jwt, cookieOptions);

    // 5. Send them into the app. A redirect, not JSON — the browser followed
    //    a redirect chain to get here, so we finish by landing them on a page.
    return reply.redirect("/");
  });
}