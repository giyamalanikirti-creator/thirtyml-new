import { NextResponse } from "next/server";
import { getMockUser, updateMockUser } from "@/lib/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MIN_BYTES = 30 * 1024; // 30 KB — too small to be a photo of an ID
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type Check = { name: string; passed: boolean; note?: string };

/** Dumb header sniff for the handful of formats we accept. */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // WEBP: 'RIFF'....'WEBP'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * POST /api/mock-auth/verify-id — multipart form with "file".
 *
 * This is a DEMO stub. It does not do real identity, document or liveness
 * verification. It runs a few sanity checks (file type/size, header sniff
 * against the claimed mime) and flips a boolean on the mock session. A real
 * build would hand this off to a KYC provider.
 */
export async function POST(req: Request) {
  if (isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const current = await getMockUser();
  if (!current) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!current.legalAge) {
    return NextResponse.json(
      { error: "Complete your profile first." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a photo of your ID" }, {
      status: 400,
    });
  }

  const checks: Check[] = [];
  const typeOk = ALLOWED_MIME.has(file.type);
  checks.push({
    name: "File type",
    passed: typeOk,
    note: typeOk ? file.type : `Got ${file.type || "unknown"}`,
  });

  const sizeOk = file.size >= MIN_BYTES && file.size <= MAX_BYTES;
  checks.push({
    name: "File size",
    passed: sizeOk,
    note: `${Math.round(file.size / 1024)} KB`,
  });

  // Peek at the first bytes and make sure the header matches the claimed mime.
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const sniffed = sniffMime(head);
  const headerMatches = sniffed !== null && sniffed === file.type;
  checks.push({
    name: "Header matches declared type",
    passed: headerMatches,
    note: sniffed ?? "Unrecognised header",
  });

  const passed = checks.every((c) => c.passed);
  if (!passed) {
    return NextResponse.json(
      {
        ok: false,
        verdict: "rejected",
        reason:
          "We couldn't accept this upload — see the checks below and try again with a clear photo of your ID.",
        checks,
        disclaimer:
          "Demo check only — not a real identity verification. No image is kept.",
      },
      { status: 400 }
    );
  }

  const user = await updateMockUser({
    idVerified: true,
    idVerifiedAt: new Date().toISOString(),
    idProvider: "demo-mock",
  });

  return NextResponse.json({
    ok: true,
    verdict: "verified",
    checks,
    user,
    disclaimer:
      "Demo check only — not a real identity verification. No image is kept.",
  });
}
