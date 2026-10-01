"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquareLock,
  Mail,
  Lock,
  AtSign,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/inbox";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const supabase = createClient();

  // Validate username
  const cleanUsername = username.trim().toLowerCase();
  const isUsernameValid = /^[a-z0-9_-]{3,20}$/.test(cleanUsername);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!cleanUsername) {
      setErrorMsg("Please choose a unique username.");
      return;
    }

    if (!isUsernameValid) {
      setErrorMsg(
        "Username must be 3-20 characters and contain only lowercase letters, numbers, underscores, or hyphens."
      );
      return;
    }

    if (!email || !password) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const origin = window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: cleanUsername,
            },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
              redirectTo
            )}`,
          },
        });

        if (error) {
          setErrorMsg(error.message);
          toast.error(error.message);
          return;
        }

        // If email confirmation is required by Supabase project settings
        if (data?.user && !data.session) {
          setIsSuccess(true);
          toast.info("Verification email sent! Check your inbox.");
        } else {
          toast.success("Account created successfully!");
          router.push(redirectTo);
          router.refresh();
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to sign up";
        setErrorMsg(message);
        toast.error(message);
      }
    });
  };

  const handleGoogleSignup = async () => {
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
        err instanceof Error ? err.message : "Google signup error";
      setErrorMsg(message);
      toast.error(message);
      setIsGoogleLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm sm:max-w-md text-center p-8 rounded-3xl bg-[#141824] border border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white">Check your email</h2>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          We&apos;ve sent a confirmation link to{" "}
          <span className="font-semibold text-white">{email}</span>. Click the
          link to activate your account and start receiving anonymous messages!
        </p>
        <Link
          href="/login"
          className="inline-flex mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
        >
          Return to Sign In
        </Link>
      </div>
    );
  }

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
          Claim your link
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Create an account and start getting anonymous feedback
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
          onClick={handleGoogleSignup}
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
          <span>Sign up with Google</span>
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            or with email
          </span>
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>

        {/* Signup form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Choose Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <AtSign className="w-4 h-4" />
              </div>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                  )
                }
                placeholder="alex"
                maxLength={20}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors font-mono"
              />
            </div>
            {cleanUsername && (
              <p className="mt-1 text-[11px] text-slate-400">
                Your link will be:{" "}
                <span className="text-pink-400 font-mono">
                  /u/{cleanUsername}
                </span>
              </p>
            )}
          </div>

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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || isGoogleLoading || !isUsernameValid}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-anony text-white font-bold text-sm shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Create My Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Switch to Login */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{" "}
        <Link
          href={`/login${
            redirectTo !== "/inbox"
              ? `?redirectTo=${encodeURIComponent(redirectTo)}`
              : ""
          }`}
          className="font-semibold text-pink-400 hover:text-pink-300 underline underline-offset-4"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#0d0f17] relative">
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}
