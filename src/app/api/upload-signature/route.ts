import { NextResponse } from "next/server";

import { buildSignedUploadParams, type SignableFolder } from "@/lib/cloudinary";
import { getClientKey, isAllowed } from "@/server/abuse";

/**
 * GET /api/upload-signature?folder=artwork
 *
 * Hands the browser a short-lived, folder-locked Cloudinary signature so quote /
 * builder artwork uploads go straight to Cloudinary without routing bytes through
 * the server (plan 8 "Cloudinary uploads from browser direct (signed)"). The
 * service api_secret never leaves the server, and the fixed folder allow-list
 * stops a client from targeting any other path.
 *
 * Plan 15.2 B3: the endpoint was unauthenticated and unthrottled (finding R1),
 * so it now spends the `upload_ip` rule (20/hour per salted IP) and answers 429
 * past it. Folder validation runs BEFORE the counter, so probing bad folders
 * cannot burn a real user's window.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("folder") ?? "artwork";
  const allowed: readonly string[] = ["artwork"];
  if (!allowed.includes(requested)) {
    return NextResponse.json({ error: "unsupported_folder" }, { status: 400 });
  }

  const clientIp = await getClientKey();
  if (clientIp && !(await isAllowed("upload_ip", clientIp))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const params = buildSignedUploadParams(requested as SignableFolder);
    if (!params) {
      return NextResponse.json(
        { error: "storage_unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(params);
  } catch {
    return NextResponse.json({ error: "signing_failed" }, { status: 500 });
  }
}
