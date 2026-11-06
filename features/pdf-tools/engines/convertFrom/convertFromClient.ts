import type {
  ConvertFromOutcome,
  ConvertFromProgress,
  ConvertFromTool,
  ConvertFromWorkerResponse,
} from "./convertFromTypes";
import { CONVERT_FROM_MIME, outputNameFor } from "./convertFromUtils";

/**
 * Client for the Convert-from-PDF Web Worker (`convertFromWorker.ts`).
 * Mirrors the structural-suite client (`../pdfWorkerClient`): run in a worker
 * when one can be created, transparently fall back to the main thread if the
 * worker fails to start, errors out, or does not answer in time. Progress
 * messages are correlated by request id so concurrent calls cannot bleed.
 */

export interface RunConvertFromOptions {
  tool: ConvertFromTool;
  bytes: ArrayBuffer;
  fileName: string;
  options: Record<string, unknown>;
  onProgress?: (progress: ConvertFromProgress) => void;
  /** Abort the worker round-trip and fall back to the main thread. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60_000;

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let requestCounter = 0;

function disposeWorker(): void {
  if (workerInstance) {
    workerInstance.onerror = null;
    workerInstance.terminate();
    workerInstance = null;
  }
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (workerInstance) return workerInstance;
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;

  try {
    const worker = new Worker(new URL("./convertFromWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = (event) => {
      console.warn(
        "[convert-from] Web Worker failed, falling back to main thread:",
        event.message
      );
      disposeWorker();
      workerUnavailable = true;
    };
    workerInstance = worker;
    return worker;
  } catch (error) {
    console.warn("[convert-from] Could not start Web Worker, using main thread:", error);
    workerUnavailable = true;
    return null;
  }
}

async function runOnMainThread(
  request: Omit<RunConvertFromOptions, "onProgress" | "timeoutMs">,
  onProgress?: (progress: ConvertFromProgress) => void
): Promise<ConvertFromOutcome> {
  const { runConvertFromJob } = await import("./convertFromWorker");
  return runConvertFromJob(request, onProgress);
}

/**
 * Runs one Convert-from-PDF job in a Web Worker, falling back to main-thread
 * execution if the worker cannot be created, errors out, or fails in time.
 */
export async function runConvertFrom(
  options: RunConvertFromOptions
): Promise<ConvertFromOutcome> {
  const { tool, bytes, fileName, options: toolOptions, onProgress, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const request = { tool, bytes, fileName, options: toolOptions };
  const worker = getWorker();

  if (worker) {
    try {
      return await new Promise<ConvertFromOutcome>((resolve, reject) => {
        const id = `convert-from-${++requestCounter}`;
        let settled = false;

        const cleanup = () => {
          clearTimeout(timer);
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
        };

        const fallBack = (reason: unknown) => {
          cleanup();
          console.warn(`[convert-from] "${tool}" did not complete in worker:`, reason);
          disposeWorker();
          workerUnavailable = true;
          runOnMainThread(request, onProgress).then(resolve, reject);
        };

        const timer = setTimeout(
          () => fallBack(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs
        );

        function onMessage(event: MessageEvent<ConvertFromWorkerResponse>) {
          const data = event.data;
          if (!data || data.id !== id) return;

          if (data.type === "progress") {
            onProgress?.(data.progress);
            return;
          }
          if (data.type === "error") {
            cleanup();
            reject(new Error(data.message || "Conversion failed"));
            return;
          }
          if (data.type === "preview") {
            cleanup();
            resolve({
              mimeType: CONVERT_FROM_MIME[tool],
              fileName: outputNameFor(tool, fileName),
              preview: data.preview,
              warnings: data.warnings ?? [],
            });
            return;
          }
          if (data.type === "done") {
            cleanup();
            resolve({
              bytes: data.bytes,
              mimeType: data.mimeType,
              fileName: data.fileName,
              metadata: data.metadata,
              warnings: data.warnings ?? [],
              preview: data.preview,
            });
          }
        }

        function onError(event: ErrorEvent) {
          fallBack(event.error ?? new Error(event.message || "The conversion worker crashed"));
        }

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);

        try {
          worker.postMessage({ id, ...request }, [bytes]);
        } catch (error) {
          fallBack(error);
        }
      });
    } catch (error) {
      console.warn(`[convert-from] "${tool}" threw, using main thread:`, error);
      disposeWorker();
      workerUnavailable = true;
    }
  }

  return runOnMainThread(request, onProgress);
}
