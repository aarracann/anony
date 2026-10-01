import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  MessageSquareLock,
  Sparkles,
  Share2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Heart,
} from "lucide-react";

export default async function HomePage() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Graceful fallback if supabase is not initialized
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0d0f17] relative overflow-hidden">
      {/* Background ambient gradient glow blobs */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-pink-600/20 via-purple-600/20 to-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-10%] w-[350px] h-[350px] bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

      {/* Header / Nav */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-anony flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform duration-200">
            <MessageSquareLock className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1">
            anony<span className="text-pink-500 text-2xl leading-none">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/inbox"
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-anony text-white shadow-md shadow-pink-500/25 hover:opacity-95 transition-all flex items-center gap-1.5"
            >
              Open Inbox
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-anony text-white shadow-md shadow-pink-500/25 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-4xl mx-auto text-center z-10 w-full">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-pink-400 mb-6 backdrop-blur-sm shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
          <span>The next-gen anonymous social experience</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-2xl leading-[1.12]">
          Send & receive{" "}
          <span className="text-gradient">anonymous messages</span> with zero friction.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-xl font-normal leading-relaxed">
          Create your personalized link, drop it in your Instagram or Snapchat
          stories, and receive unfiltered confessions, honest compliments, and
          feedback in a live inbox.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs sm:max-w-md justify-center">
          {user ? (
            <Link
              href="/inbox"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-anony text-white font-bold text-base shadow-xl shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Go to Your Inbox
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-anony text-white font-bold text-base shadow-xl shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Claim Your Link
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-base border border-slate-700/80 transition-colors flex items-center justify-center"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Interactive Visual Teaser / Preview Card */}
        <div className="mt-14 w-full max-w-sm sm:max-w-md mx-auto">
          <div className="relative rounded-3xl p-[1px] bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-blue-500/50 shadow-2xl shadow-purple-500/10">
            <div className="rounded-3xl bg-[#141824] p-6 text-left relative overflow-hidden backdrop-blur-xl">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    ?
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300">
                      Anonymous sender
                    </p>
                    <p className="text-[10px] text-slate-500">just now</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/25">
                  <Heart className="w-2.5 h-2.5 fill-pink-400" /> New
                </span>
              </div>

              {/* Message Body */}
              <p className="text-slate-100 text-base font-medium leading-relaxed">
                “You inspired me to start coding today. Keep doing what you do,
                you are amazing!”
              </p>

              {/* Bottom interactive badges */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Sender protected & verified
                </span>
                <span className="text-[11px] font-mono text-purple-400">
                  anony.app/u/you
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3.5">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Instant & Live</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Real-time inbox sync without manual refresh. Know the moment a new
              anonymous confession arrives.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3.5">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Story-Ready Cards</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Export stunning 9:16 gradient cards tailored for Instagram &
              Snapchat stories in one tap.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Safe & Moderated</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Edge rate limits, automated content filtering, and device blocking
              keep harassment away.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 z-10">
        <p>© {new Date().getFullYear()} Anony. Pure anonymous messaging.</p>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-slate-400 transition-colors">
            Login
          </Link>
          <Link href="/signup" className="hover:text-slate-400 transition-colors">
            Create Link
          </Link>
        </div>
      </footer>
    </div>
  );
}
