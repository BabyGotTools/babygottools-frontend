"use client";

import { useCallback, useRef, useState } from "react";
import { toOverallProgress } from "../engines/optimizeUtils";
import type { PhaseProgress } from "../engines/pdfTypes";

/**
 * Job runner shared by the PDF workspaces: progress aggregation, latency
 * measurement and honest failure surfacing. Progress is derived from engine
 * phases (never synthesized) — before the first phase arrives the bar stays
 * indeterminate rather than guessing.
 */

export interface PdfJobStatus {
  status: "idle" | "running" | "done" | "error";
  /** 0–100 or null while indeterminate. */
  progress: number | null;
  message: string;
  latencyMs: number | null;
  error: string | null;
}

export interface PdfJobApi {
  state: PdfJobStatus;
  running: boolean;
  /** Runs the job; returns true on success, false on failure/abort. */
  start: (run: (report: (update: PhaseProgress) => void) => Promise<void>) => Promise<boolean>;
  reset: () => void;
}

const INITIAL: PdfJobStatus = {
  status: "idle",
  progress: null,
  message: "",
  latencyMs: null,
  error: null,
};

export function usePdfJob(): PdfJobApi {
  const [state, setState] = useState<PdfJobStatus>(INITIAL);
  const startedAt = useRef(0);

  const start = useCallback(
    async (
      run: (report: (update: PhaseProgress) => void) => Promise<void>
    ): Promise<boolean> => {
      startedAt.current = performance.now();
      setState({
        status: "running",
        progress: null,
        message: "Starting…",
        latencyMs: null,
        error: null,
      });

      try {
        await run((update: PhaseProgress) => {
          setState((current) =>
            current.status === "running"
              ? {
                  ...current,
                  progress: toOverallProgress(update),
                  message: update.message ?? current.message,
                }
              : current
          );
        });
        const latencyMs = Math.round(performance.now() - startedAt.current);
        setState((current) => ({
          ...current,
          status: "done",
          progress: 100,
          message: "",
          latencyMs,
        }));
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "The operation failed");
        setState({
          status: "error",
          progress: null,
          message: "",
          latencyMs: null,
          error: message,
        });
        return false;
      }
    },
    []
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, running: state.status === "running", start, reset };
}
