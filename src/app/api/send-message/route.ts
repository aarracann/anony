import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { moderateContent } from "@/lib/moderation/filter";
import { createAdminClient } from "@/lib/supabase/admin";

const SendMessageSchema = z.object({
  username: z.string().min(1).max(50),
  body: z.string().min(1).max(500),
  deviceId: z.string().min(1).max(128),
  website: z.string().optional(), // Honeypot field
});

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();

    // 0. Bot Protection: Check honeypot field
    if (rawBody.website && String(rawBody.website).trim() !== "") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 1. Validate Input with Zod
    const validation = SendMessageSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid message payload." },
        { status: 400 }
      );
    }

    const { username, body, deviceId } = validation.data;
    const cleanBody = body.trim();
    if (cleanBody.length < 1 || cleanBody.length > 500) {
      return NextResponse.json(
        {
          ok: false,
          error: "Message must be between 1 and 500 characters.",
        },
        { status: 400 }
      );
    }

    // 2. Compute Hashes with Secret Salt
    const salt =
      process.env.HASH_SALT || "fallback-salt-local-development-at-least-32";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : "127.0.0.1";

    const device_hash = sha256Hex(`${deviceId}:${salt}`);
    const ip_hash = sha256Hex(`${clientIp}:${salt}`);

    // If Supabase service role key is not configured or in placeholder mode,
    // handle gracefully or perform operations with admin client
    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      // Admin client not configured
      return NextResponse.json(
        { ok: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    // Lookup recipient
    const { data: recipient, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, push_token")
      .ilike("username", username.trim())
      .single();

    if (profileErr || !recipient) {
      return NextResponse.json(
        { ok: false, error: "Recipient user not found." },
        { status: 404 }
      );
    }

    // 3. Reject if device_hash is in blocked_devices
    const { data: blockedRecord } = await supabase
      .from("blocked_devices")
      .select("id")
      .eq("device_hash", device_hash)
      .or(`owner_id.is.null,owner_id.eq.${recipient.id}`)
      .limit(1)
      .maybeSingle();

    if (blockedRecord) {
      return NextResponse.json(
        { ok: false, error: "Message couldn't be sent." },
        { status: 403 }
      );
    }

    // 4. Rate Limiting: 5/device/recipient/hr, 20/IP/hr
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const deviceRateKey = `dev:${device_hash}:rec:${recipient.id}`;
    const ipRateKey = `ip:${ip_hash}`;

    const [deviceLimitRes, ipLimitRes] = await Promise.all([
      supabase
        .from("rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("key", deviceRateKey)
        .gte("created_at", oneHourAgo),
      supabase
        .from("rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("key", ipRateKey)
        .gte("created_at", oneHourAgo),
    ]);

    const deviceCount = deviceLimitRes.count ?? 0;
    const ipCount = ipLimitRes.count ?? 0;

    if (deviceCount >= 5 || ipCount >= 20) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You're sending messages too fast. Please take a break and try again later.",
        },
        { status: 429 }
      );
    }

    // 5. Moderation Check
    const isSafe = moderateContent(cleanBody);
    if (!isSafe) {
      return NextResponse.json(
        { ok: false, error: "Message couldn't be sent." },
        { status: 400 }
      );
    }

    // 6. Record rate limits and Insert into messages & message_meta
    await supabase
      .from("rate_limits")
      .insert([{ key: deviceRateKey }, { key: ipRateKey }]);

    const { data: insertedMsg, error: insertMsgErr } = await supabase
      .from("messages")
      .insert({
        recipient_id: recipient.id,
        body: cleanBody,
        is_read: false,
      })
      .select("id")
      .single();

    if (insertMsgErr || !insertedMsg) {
      console.error("Failed to insert message:", insertMsgErr);
      return NextResponse.json(
        { ok: false, error: "Message couldn't be sent." },
        { status: 500 }
      );
    }

    const { error: metaErr } = await supabase.from("message_meta").insert({
      message_id: insertedMsg.id,
      device_hash,
      ip_hash,
    });

    if (metaErr) {
      console.error("Failed to insert message metadata:", metaErr);
    }

    // 7. Stubbed FCM Push Notification
    if (recipient.push_token && process.env.FCM_SERVER_KEY) {
      try {
        await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${process.env.FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: recipient.push_token,
            notification: {
              title: "New Anonymous Message! 💌",
              body:
                cleanBody.slice(0, 50) +
                (cleanBody.length > 50 ? "..." : ""),
            },
          }),
        });
      } catch (err) {
        console.error("FCM push error:", err);
      }
    }

    // 8. Return ONLY { ok: true }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("Unhandled error in send-message API:", err);
    return NextResponse.json(
      { ok: false, error: "Message couldn't be sent." },
      { status: 500 }
    );
  }
}
