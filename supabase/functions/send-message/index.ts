// Supabase Edge Function: send-message
// Follows standard Deno runtime for Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3";
import blocklist from "./blocklist.json" assert { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-device-id",
};

// Zod Input Schema
const SendMessageSchema = z.object({
  username: z.string().min(1).max(50),
  body: z.string().min(1).max(500),
  deviceId: z.string().min(1).max(128),
  website: z.string().optional(), // Honeypot field for bot protection
});

// SHA-256 Helper using Web Crypto API
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Moderation Helper: Rejects phone numbers, emails, URLs, and blocklisted words
function moderateContent(text: string): boolean {
  // 1. Phone number pattern: matches 7 to 15 digits formatted with spaces, dashes, parentheses, or dots
  const phoneRegex =
    /(?:(?:\+?\d{1,4}[\s.-]*)?(?:\(\s*\d{1,4}\s*\)[\s.-]*)?)?(?:\d[\s.-]*){6,14}\d/;
  if (phoneRegex.test(text)) return false;

  // 2. Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(text)) return false;

  // 3. URLs and links
  const urlRegex = /(https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i;
  if (urlRegex.test(text)) return false;

  // 4. Configurable blocklist
  const lower = text.toLowerCase();
  for (const term of blocklist as string[]) {
    if (term.trim() && lower.includes(term.toLowerCase().trim())) {
      return false;
    }
  }

  return true;
}

// FCM Push Notification Stub
async function sendPushNotification(pushToken: string, messageBody: string) {
  const fcmKey = Deno.env.get("FCM_SERVER_KEY");
  if (!fcmKey || !pushToken) {
    // Stubbed: Log for debugging without failing
    console.log("[Push Notification Stub]: Would notify token:", pushToken.slice(0, 10) + "...");
    return;
  }

  try {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${fcmKey}`,
      },
      body: JSON.stringify({
        to: pushToken,
        notification: {
          title: "New Anonymous Message! 💌",
          body: messageBody.slice(0, 50) + (messageBody.length > 50 ? "..." : ""),
        },
      }),
    });
  } catch (err) {
    console.error("[Push Notification Failed]:", err);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const rawBody = await req.json();

    // 0. Bot Protection: Check honeypot field
    if (rawBody.website && String(rawBody.website).trim() !== "") {
      // Fake success to misdirect bot
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate Input with Zod
    const validation = SendMessageSchema.safeParse(rawBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid message payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { username, body, deviceId } = validation.data;
    const cleanBody = body.trim();
    if (cleanBody.length < 1 || cleanBody.length > 500) {
      return new Response(
        JSON.stringify({ ok: false, error: "Message must be between 1 and 500 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Compute Hashes with Secret Salt (Never store raw IPs or raw device IDs)
    const salt = Deno.env.get("HASH_SALT") || "fallback-salt-change-in-prod";
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown-ip";

    const [device_hash, ip_hash] = await Promise.all([
      sha256Hex(`${deviceId}:${salt}`),
      sha256Hex(`${clientIp}:${salt}`),
    ]);

    // Initialize Supabase Admin Client using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up Recipient Profile
    const { data: recipient, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, push_token")
      .ilike("username", username.trim())
      .single();

    if (profileErr || !recipient) {
      return new Response(
        JSON.stringify({ ok: false, error: "Recipient user not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Reject if device_hash is in blocked_devices (global or per-owner)
    const { data: blockedRecord } = await supabase
      .from("blocked_devices")
      .select("id")
      .eq("device_hash", device_hash)
      .or(`owner_id.is.null,owner_id.eq.${recipient.id}`)
      .limit(1)
      .maybeSingle();

    if (blockedRecord) {
      // Generic error so user doesn't know exact blocking details
      return new Response(
        JSON.stringify({ ok: false, error: "Message couldn't be sent." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Rate Limiting: Max 5 messages/device/recipient/hour, Max 20 messages/IP/hour
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
      return new Response(
        JSON.stringify({
          ok: false,
          error: "You're sending messages too fast. Please take a break and try again later.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Moderation Check
    const isSafe = moderateContent(cleanBody);
    if (!isSafe) {
      return new Response(
        JSON.stringify({ ok: false, error: "Message couldn't be sent." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Record rate limits and Insert into messages & message_meta
    // Record rate limit tokens
    await supabase.from("rate_limits").insert([
      { key: deviceRateKey },
      { key: ipRateKey },
    ]);

    // Insert Message
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
      return new Response(
        JSON.stringify({ ok: false, error: "Message couldn't be sent." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert Message Metadata (Sender-identifying hashes stored ONLY here)
    const { error: metaErr } = await supabase.from("message_meta").insert({
      message_id: insertedMsg.id,
      device_hash,
      ip_hash,
    });

    if (metaErr) {
      console.error("Failed to insert message metadata:", metaErr);
    }

    // 7. Push Notification Trigger (if recipient has push_token)
    if (recipient.push_token) {
      sendPushNotification(recipient.push_token, cleanBody);
    }

    // 8. Return ONLY { ok: true } (Never leak internal IDs, hashes, or sender data)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Unhandled error in send-message edge function:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Message couldn't be sent." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
