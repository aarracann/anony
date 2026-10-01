"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquareLock,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/inbox";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(
    urlError === "auth_callback_failed"
      ? "Authentication callback failed. Please try again."
      : ""
  );
  const [isPending, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    startTransition(async () => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message);
          toast.error(error.message);
          return;
        }

        toast.success("Welcome back!");
        router.push(redirectTo);
        router.refresh();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to sign in";
        setErrorMsg(message);
        toast.error(message);
      }
    });
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setIsGoogleLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
            redirectTo
          )}`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign in error";
      setErrorMsg(message);
      toast.error(message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md">
      {/* Brand logo & header */}
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 group mb-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-anony flex items-center justify-center shadow-lg shadow-pink-500/25 group-hover:scale-105 transition-transform">
            <MessageSquareLock className="w-6 h-6 text-white" />
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign in to check your anonymous messages
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isPending}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-5 shadow-sm"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            or with email
          </span>
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || isGoogleLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-anony text-white font-bold text-sm shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Switch to Signup */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Don&apos;t have an account yet?{" "}
        <Link
          href={`/signup${
            redirectTo !== "/inbox"
              ? `?redirectTo=${encodeURIComponent(redirectTo)}`
              : ""
          }`}
          className="font-semibold text-pink-400 hover:text-pink-300 underline underline-offset-4"
        >
          Create your link now
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#0d0f17] relative">
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-pink-600/15 blur-[120px] rounded-full pointer-events-none" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
