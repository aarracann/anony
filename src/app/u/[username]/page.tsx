"use client";

import { useState, useEffect, useTransition, use } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { getOrCreateDeviceId } from "@/lib/client-device";
import {
  Send,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  MessageSquareLock,
} from "lucide-react";
import { toast } from "sonner";

interface PublicSendPageProps {
  params: Promise<{ username: string }>;
}

export default function PublicSendPage({ params }: PublicSendPageProps) {
  const resolvedParams = use(params);
  const username = decodeURIComponent(resolvedParams.username);

  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const maxLength = 500;
  const charsLeft = maxLength - body.length;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanBody = body.trim();
    if (!cleanBody) {
      toast.error("Please enter a message before sending.");
      return;
    }

    if (cleanBody.length > maxLength) {
      toast.error(`Message cannot exceed ${maxLength} characters.`);
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          username,
          body: cleanBody,
          deviceId: deviceId || getOrCreateDeviceId(),
          website: honeypot, // Honeypot field
        };

        // Attempt Edge Function first, then fallback to Next.js API route
        const edgeUrl =
          process.env.NEXT_PUBLIC_EDGE_FUNCTION_URL ||
          (process.env.NEXT_PUBLIC_SUPABASE_URL
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-message`
            : null);

        let res: Response | null = null;
        let usedEdge = false;

        if (
          edgeUrl &&
          !edgeUrl.includes("placeholder-project") &&
          !edgeUrl.includes("your-project-id")
        ) {
          try {
            res = await fetch(edgeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              },
              body: JSON.stringify(payload),
            });
            usedEdge = true;
          } catch {
            // Edge call network failed; fall back to local API route
            usedEdge = false;
          }
        }

        if (!usedEdge || !res) {
          res = await fetch("/api/send-message", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          const errMsg = data.error || "Message couldn't be sent.";
          toast.error(errMsg);
          return;
        }

        // Success!
        setIsSuccess(true);
        setBody("");
        // Celebrate with confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981"],
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";
        toast.error(message);
      }
    });
  };

  const handleReset = () => {
    setIsSuccess(false);
    setBody("");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0d0f17] px-4 py-6 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-pink-600/20 via-purple-600/20 to-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[320px] h-[320px] bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between z-10 mb-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-anony flex items-center justify-center shadow-md shadow-pink-500/20 group-hover:scale-105 transition-transform">
            <MessageSquareLock className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">
            anony<span className="text-pink-500">.</span>
          </span>
        </Link>

        <Link
          href="/signup"
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-pink-400" />
          Get your link
        </Link>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center z-10 my-4">
        {isSuccess ? (
          /* Success Card */
          <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-7 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">
              Message Sent! 🎉
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Your anonymous message has been safely delivered to{" "}
              <span className="font-semibold text-pink-400">@{username}</span>
              &apos;s private inbox.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700/80 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Send another message</span>
              </button>

              <Link
                href="/signup"
                className="w-full py-3 px-4 rounded-xl bg-gradient-anony text-white font-bold text-sm shadow-lg shadow-pink-500/25 hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Get your own anonymous link</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Send Message Card */
          <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative">
            {/* Recipient Profile header */}
            <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-800/80">
              <div className="w-12 h-12 rounded-2xl bg-gradient-anony flex items-center justify-center text-lg font-black text-white shadow-lg shadow-pink-500/20 uppercase shrink-0">
                {username.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-bold text-white truncate">
                    @{username}
                  </h1>
                  <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send me anonymous messages!
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSend} className="space-y-4">
              {/* Bot Honeypot (hidden from real users) */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden pointer-events-none"
                aria-hidden="true"
              />

              <div className="relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, maxLength))}
                  placeholder="Say something nice, ask a question, or confess anything..."
                  rows={5}
                  disabled={isPending}
                  className="w-full p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors resize-none leading-relaxed"
                />

                {/* Live Character Counter */}
                <div className="flex items-center justify-between px-1 mt-1 text-[11px]">
                  <span className="text-slate-500">Anonymous & private</span>
                  <span
                    className={`font-mono font-medium ${
                      charsLeft < 50
                        ? charsLeft < 10
                          ? "text-red-400 font-bold"
                          : "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {body.length} / {maxLength}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || body.trim().length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-anony text-white font-bold text-sm shadow-xl shadow-pink-500/25 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Anonymous Message</span>
                  </>
                )}
              </button>
            </form>

            {/* Safety notice (strictly required) */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400 leading-tight">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Messages are anonymous but abuse can be reported and blocked.
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-500 py-3 z-10">
        <p>
          Powered by{" "}
          <Link href="/" className="font-semibold text-slate-400 hover:text-white">
            Anony
          </Link>{" "}
          • Zero login required to send
        </p>
      </footer>
    </div>
  );
}
