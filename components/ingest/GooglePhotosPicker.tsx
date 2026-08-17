"use client";

import { useEffect, useRef, useState } from "react";

import {
  importGooglePhotosAction,
  pollGooglePhotosPickerAction,
  startGooglePhotosPickerAction,
} from "@/lib/ingestion/actions";

type State =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "importing" }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 120; // ~6 minutes before giving up

export function GooglePhotosPicker() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending poll timer on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function start() {
    setState({ kind: "picking" });
    try {
      const { sessionId, pickerUri } = await startGooglePhotosPickerAction();
      window.open(pickerUri, "_blank", "noopener,noreferrer");
      poll(sessionId, 0);
    } catch (error) {
      setState({ kind: "error", message: friendlyError(error) });
    }
  }

  function poll(sessionId: string, attempt: number) {
    timer.current = setTimeout(async () => {
      try {
        const ready = await pollGooglePhotosPickerAction(sessionId);
        if (ready) {
          setState({ kind: "importing" });
          // Redirects to the first review on success.
          await importGooglePhotosAction(sessionId);
          return;
        }
        if (attempt + 1 >= MAX_POLLS) {
          setState({ kind: "error", message: "Timed out waiting for your selection." });
          return;
        }
        poll(sessionId, attempt + 1);
      } catch (error) {
        setState({ kind: "error", message: friendlyError(error) });
      }
    }, POLL_INTERVAL_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={state.kind === "picking" || state.kind === "importing"}
        className="rounded-full border border-black/10 px-5 py-2.5 text-sm transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
      >
        {state.kind === "picking"
          ? "Waiting for your selection…"
          : state.kind === "importing"
            ? "Importing…"
            : "Choose from Google Photos"}
      </button>

      {state.kind === "picking" ? (
        <p className="text-xs text-black/50 dark:text-white/50">
          A Google Photos window opened in a new tab. Pick your clothing photos
          there, then come back — we&apos;ll detect the items automatically.
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not connected") || message.includes("401") || message.includes("403")) {
    return "Reconnect your Google account (sign out and back in) to grant Google Photos access.";
  }
  return "Something went wrong with Google Photos. Please try again.";
}
