import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientMeta, createSessionFor } from "@/lib/auth/server";

const GENERIC_ERROR = "Correo o contraseña incorrectos.";

// ────────── C2: dummy hash for timing-attack mitigation ──────────
// Generated once per process. The verifyPassword cost equals a real check so
// "unknown email" and "known email + bad password" finish in the same time.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      "decoy-" + randomBytes(16).toString("hex"),
    );
  }
  return dummyHashPromise;
}

// ────────── C3: in-memory sliding-window rate limits ──────────
type Bucket = { count: number; resetAt: number };

// Per-IP limiter: best-effort first line of defense. NOTE: the IP comes from
// X-Forwarded-For, which a client can spoof unless a trusted proxy overwrites
// it. Apache should be configured to set XFF from the real peer; even so, the
// per-ACCOUNT limiter below is the authoritative brute-force defense because it
// cannot be bypassed by rotating the forwarded IP.
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;
const ipBuckets = new Map<string, Bucket>();

// Per-account limiter: caps FAILED attempts per email so spoofing the IP can't
// grant unlimited guesses against a specific account.
const EMAIL_MAX = 5;
const EMAIL_WINDOW_MS = 15 * 60_000;
const emailBuckets = new Map<string, Bucket>();

function gc(map: Map<string, Bucket>, now: number) {
  if (map.size > 5000) {
    for (const [k, v] of map) if (v.resetAt < now) map.delete(k);
  }
}

function rateCheck(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  gc(ipBuckets, now);
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (b.count >= RATE_MAX) {
    return { allowed: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { allowed: true, retryAfter: 0 };
}

function emailBlocked(email: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  const b = emailBuckets.get(email);
  if (!b || b.resetAt < now) return { blocked: false, retryAfter: 0 };
  if (b.count >= EMAIL_MAX) {
    return { blocked: true, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

function recordEmailFailure(email: string): void {
  const now = Date.now();
  gc(emailBuckets, now);
  const b = emailBuckets.get(email);
  if (!b || b.resetAt < now) {
    emailBuckets.set(email, { count: 1, resetAt: now + EMAIL_WINDOW_MS });
  } else {
    b.count++;
  }
}

function clearEmailFailures(email: string): void {
  emailBuckets.delete(email);
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const ip = await getClientIp();
  const rate = rateCheck(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Demasiados intentos. Vuelve a intentarlo en ${rate.retryAfter}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { email, password } =
    typeof body === "object" && body !== null
      ? (body as { email?: unknown; password?: unknown })
      : {};

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Per-account throttle: cannot be bypassed by rotating the forwarded IP.
  const accountBlock = emailBlocked(normalizedEmail);
  if (accountBlock.blocked) {
    return NextResponse.json(
      {
        error: `Demasiados intentos para esta cuenta. Vuelve a intentarlo en ${accountBlock.retryAfter}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(accountBlock.retryAfter) },
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // C2: equalize timing — always run a scrypt verify, even when the email
  // doesn't exist. Discard the result; return the same generic 401.
  if (!user || !user.active) {
    await verifyPassword(password, await getDummyHash());
    recordEmailFailure(normalizedEmail);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    recordEmailFailure(normalizedEmail);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Successful auth clears the account's failure counter.
  clearEmailFailures(normalizedEmail);

  const meta = await clientMeta();
  const h = await headers();
  const isMobile = h.get("x-client") === "mobile";
  const session = await createSessionFor(user.id, meta, {
    clientType: isMobile ? "mobile" : "web",
    returnToken: isMobile,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  if (isMobile && session) {
    return NextResponse.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
