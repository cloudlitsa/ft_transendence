// Auth helpers: JWT creation/verification and the cookie settings.
// Centralized so signup, login, and the auth check all use identical logic.

import jwt from "jsonwebtoken";

// The secret used to sign JWTs. MUST come from the environment — never
// hardcode. If it's missing we crash on purpose at startup: better a loud
// failure now than silently issuing tokens signed with "undefined".
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file.");
}

// What we store inside the token. Keep it minimal: just enough to know
// who the user is. Never put secrets or sensitive data in a JWT — the
// payload is readable by anyone who has the token (it's signed, not encrypted).
export interface TokenPayload {
  userId: string;
}

const TOKEN_LIFETIME = "7d"; // re-login required after 7 days

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: TOKEN_LIFETIME });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
  } catch {
    // expired, malformed, or signed with a different secret — all invalid
    return null;
  }
}

// Cookie settings used everywhere we set or clear the auth cookie.
// - httpOnly: JavaScript in the browser cannot read it (XSS protection)
// - sameSite "lax": cookie not sent on cross-site POSTs (CSRF mitigation)
// - secure: only send over HTTPS. False in dev (we're on plain http://localhost),
//   MUST be true in production. Controlled by NODE_ENV.
// - path "/": valid for the whole site
export const AUTH_COOKIE = "auth_token";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, in seconds — matches TOKEN_LIFETIME
};
