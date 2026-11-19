import { NextResponse } from "next/server";
import { signupDetailsSchema } from "@/lib/validation/auth";
import { updateMockUser, getMockUser } from "@/lib/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * PUT /api/mock-auth/profile — set name/dob/city on the logged-in mock
 * user. Also sets legalAge from the DOB (must be 18+).
 */
export async function PUT(req: Request) {
  if (isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const current = await getMockUser();
  if (!current) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupDetailsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await updateMockUser({
    fullName: parsed.data.fullName,
    dateOfBirth: parsed.data.dateOfBirth,
    city: parsed.data.homeCity,
    legalAge: true, // schema already enforces 18+
  });
  return NextResponse.json({ ok: true, user });
}
