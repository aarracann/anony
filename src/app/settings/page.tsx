"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  AtSign,
  Copy,
  Check,
  Trash2,
  Bell,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  const [isUpdatingUsername, startUpdateUsername] = useTransition();
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("username, push_token")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCurrentUsername(profile.username);
          setNewUsername(profile.username);
          setPushEnabled(Boolean(profile.push_token));
        }
      } catch (err) {
        console.error("Settings load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router, supabase]);

  const publicLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${currentUsername}`
      : `/u/${currentUsername}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopiedLink(true);
      confetti({
        particleCount: 30,
        spread: 45,
        origin: { y: 0.3 },
      });
      toast.success("Public link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsername.trim().toLowerCase();

    if (!clean) {
      toast.error("Username cannot be empty");
      return;
    }

    if (!/^[a-z0-9_-]{3,20}$/.test(clean)) {
      toast.error(
        "Username must be 3-20 characters with only lowercase letters, numbers, underscores, or hyphens."
      );
      return;
    }

    if (clean === currentUsername) {
      toast.info("No change detected.");
      return;
    }

    startUpdateUsername(async () => {
      try {
        // Check if username is already taken
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", clean)
          .maybeSingle();

        if (existing && existing.id !== userId) {
          toast.error("This username is already taken. Try another!");
          return;
        }

        // Update profile
        const { error } = await supabase
          .from("profiles")
          .update({
            username: clean,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
          toast.error("Failed to update username: " + error.message);
          return;
        }

        setCurrentUsername(clean);
        toast.success("Username updated successfully!");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error updating username";
        toast.error(message);
      }
    });
  };

  const handleTogglePush = async () => {
    const nextState = !pushEnabled;
    setPushEnabled(nextState);

    try {
      // In a full FCM/PWA deployment, this would register a ServiceWorker and get a real token.
      // Here we stub a token to enable push notification routing.
      const mockToken = nextState ? `fcm_token_stub_${userId?.slice(0, 8)}` : null;

      await supabase
        .from("profiles")
        .update({ push_token: mockToken })
        .eq("id", userId);

      toast.success(
        nextState
          ? "Push notifications enabled!"
          : "Push notifications disabled."
      );
    } catch {
      setPushEnabled(!nextState);
      toast.error("Failed to update notification settings");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete") {
      toast.error("Please type 'delete' to confirm.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast.success("Account deleted. We're sorry to see you go.");
        router.push("/");
        router.refresh();
      } else {
        toast.error(data.error || "Failed to delete account");
        setIsDeleting(false);
      }
    } catch {
      toast.error("Error connecting to server to delete account.");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f17]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white flex flex-col relative overflow-x-hidden pb-16">
      {/* Background ambient gradient glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full bg-[#0d0f17]/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href="/inbox"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inbox</span>
          </Link>
          <span className="text-xs font-mono text-slate-500">{email}</span>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="max-w-2xl w-full mx-auto px-4 pt-6 flex-1 z-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your username, public link, and account privacy.
          </p>
        </div>

        {/* 1. Public Link Card */}
        <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2.5 mb-3 text-pink-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Your Public Link</span>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Anyone with this link can send you anonymous messages. You can post
            it on your Instagram story sticker, TikTok bio, or Snapchat!
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 truncate">
              {publicLink}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-anony text-white font-bold text-xs shadow-md shadow-pink-500/20 hover:opacity-95 transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <Link
                href={`/u/${currentUsername}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Open public page"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Change Username Card */}
        <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2.5 mb-3 text-purple-400 font-bold text-sm">
            <AtSign className="w-4 h-4" />
            <span>Change Username</span>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Changing your username will instantly update your public link. Your
            old link will stop receiving messages.
          </p>

          <form onSubmit={handleUpdateUsername} className="space-y-4">
            <div>
              <label
                htmlFor="newUsername"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                New Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  id="newUsername"
                  type="text"
                  value={newUsername}
                  onChange={(e) =>
                    setNewUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                    )
                  }
                  maxLength={20}
                  placeholder="new_username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingUsername || newUsername === currentUsername}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isUpdatingUsername ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Save Username"
              )}
            </button>
          </form>
        </div>

        {/* 3. Notifications */}
        <div className="rounded-3xl bg-[#141824] border border-slate-800/80 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Push Notifications
                </h3>
                <p className="text-xs text-slate-400">
                  Get notified when someone sends you an anonymous message
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePush}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                pushEnabled ? "bg-pink-500" : "bg-slate-800"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  pushEnabled ? "translate-x-6" : "translate-x-0.5"
                } top-0.5 absolute`}
              />
            </button>
          </div>
        </div>

        {/* 4. Danger Zone: Delete Account */}
        <div className="rounded-3xl bg-red-950/20 border border-red-900/30 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2.5 mb-2 text-red-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Danger Zone</span>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Permanently delete your account, your username, and all received
            messages. This action cannot be undone.
          </p>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete My Account</span>
          </button>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#121622] border border-red-900/40 rounded-3xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white text-center">
              Are you sure?
            </h3>
            <p className="mt-1 text-xs text-slate-400 text-center leading-relaxed">
              This will permanently delete your account and all anonymous
              messages in your inbox.
            </p>

            <div className="mt-4">
              <label className="block text-[11px] text-slate-400 mb-1">
                Type <span className="font-bold text-white">delete</span> to
                confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  isDeleting || deleteConfirmText.toLowerCase() !== "delete"
                }
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
