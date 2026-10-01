"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Sparkles,
  Loader2,
  MessageSquareLock,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface StoryCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageBody?: string;
  username: string;
  isInvite?: boolean;
}

export function StoryCardModal({
  isOpen,
  onClose,
  messageBody,
  username,
  isInvite = false,
}: StoryCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  if (!isOpen) return null;

  const publicLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${username}`
      : `https://anony.app/u/${username}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopiedLink(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // High resolution for crisp stories
      });

      const link = document.createElement("a");
      link.download = `anony-${username}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      toast.success("Story card downloaded!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export image.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        setCopiedImage(true);
        toast.success("Image copied to clipboard! Paste it into Instagram.");
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        // Fallback: download if copy image is not supported by browser
        handleDownloadImage();
      }
    } catch {
      toast.info("Image copy not supported by your browser, downloading instead.");
      handleDownloadImage();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#121622] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="mb-4 text-left">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            {isInvite ? "Share Your Link to Story" : "Share Anonymous Message"}
          </h3>
          <p className="text-xs text-slate-400">
            Instagram & Snapchat Story ready (9:16 aspect ratio)
          </p>
        </div>

        {/* Story Card Preview (Render target for toPng) */}
        <div className="flex justify-center my-3">
          <div
            ref={cardRef}
            className="w-[280px] h-[460px] rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden shadow-2xl select-none"
            style={{
              background:
                "linear-gradient(145deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)",
            }}
          >
            {/* Top Bar on story */}
            <div className="flex items-center justify-between text-white/90 z-10">
              <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold">
                <MessageSquareLock className="w-3.5 h-3.5" />
                <span>anony.</span>
              </div>
              <span className="text-[10px] font-mono bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full">
                @{username}
              </span>
            </div>

            {/* Middle Message Sticker Box */}
            <div className="my-auto z-10">
              <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-2xl border border-white/60">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-anony text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 leading-tight">
                      @{username}
                    </p>
                    <p className="text-[9px] text-slate-500 leading-tight">
                      {isInvite
                        ? "send me anonymous messages!"
                        : "received an anonymous message:"}
                    </p>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-900 leading-snug break-words">
                  {isInvite
                    ? "Ask me anything, confess your thoughts, or say what's on your mind... 100% anonymously!"
                    : messageBody || "No message content"}
                </p>
              </div>

              {/* Tap to reply sticker badge */}
              <div className="mt-4 flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20 shadow-lg">
                  <span>🔗</span>
                  <span className="font-mono text-[10px]">
                    anony.app/u/{username}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Swipe Up Prompt */}
            <div className="text-center text-white/90 text-[10px] font-medium z-10">
              <p>Swipe up or tap sticker to reply</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-anony text-white text-xs font-bold shadow-md shadow-pink-500/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Save Image</span>
          </button>

          <button
            onClick={handleCopyImage}
            disabled={isExporting}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
          >
            {copiedImage ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Image</span>
              </>
            )}
          </button>
        </div>

        <button
          onClick={handleCopyLink}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium transition-all cursor-pointer"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-pink-400 font-semibold">
                Link copied to clipboard!
              </span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>Copy Public Link (/u/{username})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
