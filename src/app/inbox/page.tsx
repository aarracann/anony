"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StoryCardModal } from "@/components/StoryCardModal";
import { ReportModal } from "@/components/ReportModal";
import {
  MessageSquareLock,
  Share2,
  Copy,
  Check,
  Trash2,
  Eye,
  Settings,
  LogOut,
  Sparkles,
  Inbox as InboxIcon,
  ShieldAlert,
  Loader2,
  Flame,
  Radio,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface MessageItem {
  id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface ProfileData {
  id: string;
  username: string;
  created_at: string;
}

export default function InboxPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals state
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [selectedStoryMessage, setSelectedStoryMessage] = useState("");
  const [isInviteStory, setIsInviteStory] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportMessageId, setSelectedReportMessageId] = useState("");

  const [isBlocking, setIsBlocking] = useState<string | null>(null);

  // Format relative time helper
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

      if (diffSeconds < 60) return "just now";
      const diffMinutes = Math.floor(diffSeconds / 60);
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  // Fetch initial profile and messages
  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      } else {
        // Fallback default
        setProfile({
          id: user.id,
          username: user.email ? user.email.split("@")[0] : "user",
          created_at: new Date().toISOString(),
        });
      }

      // Fetch messages ordered newest first
      const { data: messagesData, error: msgError } = await supabase
        .from("messages")
        .select("id, recipient_id, body, is_read, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (!msgError && messagesData) {
        setMessages(messagesData);
      }
    } catch (err) {
      console.error("Inbox load error:", err);
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`inbox_realtime_${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageItem;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
          toast("💌 New anonymous message arrived!", {
            description: newMsg.body.slice(0, 45) + (newMsg.body.length > 45 ? "..." : ""),
            action: {
              label: "View",
              onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
            },
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as MessageItem;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, supabase]);

  // Mark message as read
  const handleMarkAsRead = async (id: string, currentReadStatus: boolean) => {
    if (currentReadStatus) return; // already read

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
    );

    try {
      await supabase.from("messages").update({ is_read: true }).eq("id", id);
    } catch {
      // Revert if error
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_read: false } : m))
      );
    }
  };

  // Delete message
  const handleDelete = async (id: string) => {
    const previousMessages = messages;
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Message deleted");

    try {
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) {
        setMessages(previousMessages);
        toast.error("Failed to delete message: " + error.message);
      }
    } catch {
      setMessages(previousMessages);
      toast.error("Failed to delete message");
    }
  };

  // Block sender device
  const handleBlockSender = async (messageId: string) => {
    if (
      !confirm(
        "Block this sender? They will be permanently blocked from sending messages to your inbox."
      )
    ) {
      return;
    }

    setIsBlocking(messageId);
    try {
      const res = await fetch("/api/block-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason: "Blocked from inbox" }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast.success(
          "Sender blocked! They cannot send any further messages."
        );
      } else {
        toast.error(data.error || "Could not block sender.");
      }
    } catch {
      toast.error("Error connecting to server to block sender.");
    } finally {
      setIsBlocking(null);
    }
  };

  // Copy Public Link
  const publicLink =
    typeof window !== "undefined" && profile
      ? `${window.location.origin}/u/${profile.username}`
      : `/u/${profile?.username || ""}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopiedLink(true);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.2 },
      });
      toast.success("Public link copied! Share it on your story.");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const filteredMessages =
    activeFilter === "unread"
      ? messages.filter((m) => !m.is_read)
      : messages;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f17]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading your inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white flex flex-col relative overflow-x-hidden pb-16">
      {/* Background ambient gradient glow blobs */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-pink-600/15 via-purple-600/15 to-blue-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full bg-[#0d0f17]/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-anony flex items-center justify-center shadow-md shadow-pink-500/20 group-hover:scale-105 transition-transform">
              <MessageSquareLock className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">
              anony<span className="text-pink-500">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-400 hover:text-red-400 transition-colors border border-slate-700/60"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Inbox Container */}
      <main className="max-w-2xl w-full mx-auto px-4 pt-6 flex-1 z-10">
        {/* User Link Sharing Hero Card */}
        <div className="rounded-3xl bg-[#141824] border border-slate-800/90 p-5 sm:p-6 shadow-xl relative overflow-hidden mb-6 glow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-anony flex items-center justify-center text-lg font-black text-white shadow-lg shadow-pink-500/25 shrink-0 uppercase">
                {profile?.username.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white truncate">
                    @{profile?.username}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                    Live
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  anony.app/u/{profile?.username}
                </p>
              </div>
            </div>

            {/* Link Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-anony text-white font-bold text-xs shadow-md shadow-pink-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
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

              <button
                type="button"
                onClick={() => {
                  setIsInviteStory(true);
                  setSelectedStoryMessage("");
                  setStoryModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                title="Create Instagram Story Card"
              >
                <Share2 className="w-3.5 h-3.5 text-pink-400" />
                <span>Story Card</span>
              </button>

              <Link
                href={`/u/${profile?.username}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
                title="Preview public page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Inbox Sub-header: Filters & Counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-pink-500" />
              Inbox
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-pink-500 text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({messages.length})
            </button>
            <button
              onClick={() => setActiveFilter("unread")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === "unread"
                  ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Message List or Empty State */}
        {filteredMessages.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl bg-[#141824]/60 border border-slate-800/80 p-8 text-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mx-auto mb-3.5">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">
              {activeFilter === "unread"
                ? "You're all caught up!"
                : "No messages yet"}
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              {activeFilter === "unread"
                ? "Every message in your inbox has been marked as read."
                : "Share your link on your Instagram or Snapchat stories to receive your first anonymous message!"}
            </p>

            {activeFilter === "all" && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-anony text-white font-bold text-xs shadow-md shadow-pink-500/25 hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Your Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteStory(true);
                    setSelectedStoryMessage("");
                    setStoryModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-pink-400" />
                  <span>Share Story Card</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* List of Messages */
          <div className="space-y-3">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => handleMarkAsRead(msg.id, msg.is_read)}
                className={`rounded-2xl border p-4 sm:p-5 transition-all relative group cursor-pointer ${
                  !msg.is_read
                    ? "bg-[#181d2c] border-pink-500/40 shadow-lg shadow-pink-500/5 hover:border-pink-500/60"
                    : "bg-[#121622] border-slate-800/80 hover:border-slate-700/80 text-slate-300"
                }`}
              >
                {/* Message Top row */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                      ?
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      Anonymous
                    </span>
                    {!msg.is_read && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-pink-500 text-white">
                        <Flame className="w-2.5 h-2.5 fill-white" /> NEW
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                {/* Message Body */}
                <p
                  className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    !msg.is_read ? "text-white font-medium" : "text-slate-300"
                  }`}
                >
                  {msg.body}
                </p>

                {/* Card Bottom Actions */}
                <div
                  className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Share as Image Card Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteStory(false);
                      setSelectedStoryMessage(msg.body);
                      setStoryModalOpen(true);
                      handleMarkAsRead(msg.id, msg.is_read);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/25 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share to Story</span>
                  </button>

                  {/* Actions Group (Mark Read, Delete, Block, Report) */}
                  <div className="flex items-center gap-1">
                    {!msg.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(msg.id, false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                        title="Mark as read"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleBlockSender(msg.id)}
                      disabled={isBlocking === msg.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                      title="Block sender's device"
                    >
                      {isBlocking === msg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <ShieldAlert className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportMessageId(msg.id);
                        setReportModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-slate-800 transition-colors"
                      title="Report message"
                    >
                      <span className="text-xs font-bold">!</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share to Story Modal */}
      <StoryCardModal
        isOpen={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        messageBody={selectedStoryMessage}
        username={profile?.username || "user"}
        isInvite={isInviteStory}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        messageId={selectedReportMessageId}
      />
    </div>
  );
}
