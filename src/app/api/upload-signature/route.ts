import { NextResponse } from "next/server";

import { buildSignedUploadParams, type SignableFolder } from "@/lib/cloudinary";

/**
 * GET /api/upload-signature?folder=artwork
 *
 * Hands the browser a short-lived, folder-locked Cloudinary signature so quote /
 * builder artwork uploads go straight to Cloudinary without routing bytes through
 * the server (plan 8 "Cloudinary uploads from browser direct (signed)"). The
 * service api_secret never leaves the server, and the fixed folder allow-list
 * stops a client from targeting any other path.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("folder") ?? "artwork";
  const allowed: readonly string[] = ["artwork"];
  if (!allowed.includes(requested)) {
    return NextResponse.json({ error: "unsupported_folder" }, { status: 400 });
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
