"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
}

const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Threats of violence or self-harm",
  "Spam, scam, or advertising",
  "Inappropriate or sexually explicit",
  "Other abuse",
];

export function ReportModal({ isOpen, onClose, messageId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const finalReason =
      selectedReason === "Other abuse" && customReason.trim()
        ? `Other: ${customReason.trim()}`
        : selectedReason;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("reports").insert({
        message_id: messageId,
        reporter_id: user?.id,
        reason: finalReason,
      });

      if (error) {
        toast.error("Could not submit report: " + error.message);
      } else {
        toast.success(
          "Report submitted. Our safety team has been notified."
        );
        onClose();
      }
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#121622] border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 text-amber-400 mb-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-white text-base">Report Message</h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Select a reason for reporting this anonymous message:
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedReason === reason
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-amber-400"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>

          {selectedReason === "Other abuse" && (
            <input
              type="text"
              placeholder="Describe the issue..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Submit Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
