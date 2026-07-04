export type AccountSession = {
  id: string;
  current: boolean;
  clientType: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
};

export type AccountData = {
  name: string;
  email: string;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
  sessions: AccountSession[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
