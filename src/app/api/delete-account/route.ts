import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Call Supabase admin to permanently delete the auth user
    // (Postgres cascade rules will automatically wipe profiles, messages, message_meta)
    const admin = createAdminClient();
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);

    if (deleteErr) {
      console.error("Failed to delete user:", deleteErr);
      return NextResponse.json(
        { ok: false, error: deleteErr.message },
        { status: 500 }
      );
    }

    // Sign out session
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete account";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
