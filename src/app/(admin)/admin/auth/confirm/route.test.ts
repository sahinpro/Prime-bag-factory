import { describe, expect, it, vi } from "vitest";

// Mock the cookie-session client before the route imports it: the unit test
// exercises the PKCE `code` branch with a fake GoTrue, never a real stack.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function mockAuth(auth: Record<string, unknown>) {
  vi.mocked(createClient).mockResolvedValue(auth as never);
}

describe("GET /admin/auth/confirm — code (PKCE) path", () => {
  it("exchanges the code for a session and lands on reset-password", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { user: { id: "u-1" }, session: {} },
      error: null,
    });
    mockAuth({ auth: { exchangeCodeForSession } });

    const response = await GET(
      new NextRequest("http://127.0.0.1:3000/admin/auth/confirm?code=abc123"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(302);
    // `NextRequest.url` normalizes the host, so compare path + search only.
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/reset-password");
    expect(location.search).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("bounces a failed exchange to forgot-password with the generic reason", async () => {
    mockAuth({
      auth: {
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "invalid" } }),
      },
    });

    const response = await GET(
      new NextRequest("http://127.0.0.1:3000/admin/auth/confirm?code=bad"),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/forgot-password");
    expect(location.searchParams.get("reason")).toBe("invalid");
  });

  it("treats a request with no code and no token as an invalid link", async () => {
    mockAuth({
      auth: {
        exchangeCodeForSession: vi.fn(),
        verifyOtp: vi.fn(),
      },
    });

    const response = await GET(
      new NextRequest("http://127.0.0.1:3000/admin/auth/confirm"),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/forgot-password");
    expect(location.searchParams.get("reason")).toBe("invalid");
  });
});
