import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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

    const { messageId, reason } = await request.json();
    if (!messageId) {
      return NextResponse.json(
        { ok: false, error: "Message ID is required" },
        { status: 400 }
      );
    }

    // 1. First try calling the secure RPC function directly
    const { error: rpcError } = await supabase.rpc(
      "block_sender_by_message_id",
      {
        p_message_id: messageId,
        p_reason: reason || "Blocked by recipient",
      }
    );

    if (!rpcError) {
      return NextResponse.json({ ok: true });
    }

    // 2. Fallback to service role if RPC is not deployed yet in current environment
    const admin = createAdminClient();

    // Verify ownership of the message
    const { data: message, error: msgErr } = await admin
      .from("messages")
      .select("recipient_id")
      .eq("id", messageId)
      .single();

    if (msgErr || !message || message.recipient_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Message not found or not owned by you." },
        { status: 403 }
      );
    }

    // Get device_hash from message_meta (service role only)
    const { data: meta } = await admin
      .from("message_meta")
      .select("device_hash")
      .eq("message_id", messageId)
      .single();

    if (meta?.device_hash) {
      await admin.from("blocked_devices").upsert(
        {
          owner_id: user.id,
          device_hash: meta.device_hash,
          reason: reason || "Blocked by recipient",
          created_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,device_hash" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to block sender";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
