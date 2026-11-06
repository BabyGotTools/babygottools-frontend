import type {
  OperationPayloadMap,
  OperationType,
  ProgressReporter,
  WorkerResponse,
} from "./pdfOps";

export type {
  AddBlankPayload,
  InsertPayload,
  MergePayload,
  NUpPayload,
  OperationPayloadMap,
  OperationType,
  OrganizePayload,
  PageSelectionPayload,
  ProgressReporter,
  RotatePayload,
  SplitPayload,
  WorkerResponse,
} from "./pdfOps";

export interface RunOperationOptions<K extends OperationType> {
  type: K;
  payload: OperationPayloadMap[K];
  onProgress?: ProgressReporter;
  /** Abort the worker round-trip and fall back to the main thread. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

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
    const worker = new Worker(new URL("./pdfOps.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = (event) => {
      console.warn(
        "[pdf] Web Worker failed, falling back to main thread:",
        event.message
      );
      disposeWorker();
      workerUnavailable = true;
    };
    workerInstance = worker;
    return worker;
  } catch (error) {
    console.warn("[pdf] Could not start Web Worker, using main thread:", error);
    workerUnavailable = true;
    return null;
  }
}

/**
 * Runs `type` in a Web Worker, falling back to main-thread execution if the
 * worker cannot be created, errors out, or fails to answer in time.
 */
export async function runPdfOperation<K extends OperationType>(
  options: RunOperationOptions<K>
): Promise<Uint8Array> {
  const { type, payload, onProgress, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const worker = getWorker();

  if (worker) {
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const id = `pdf-op-${++requestCounter}`;

        const cleanup = () => {
          clearTimeout(timer);
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
        };

        const fallBack = (reason: unknown) => {
          cleanup();
          console.warn(`[pdf] Worker "${type}" did not complete:`, reason);
          disposeWorker();
          workerUnavailable = true;
          runOnMainThread(type, payload, onProgress).then(resolve, reject);
        };

        const timer = setTimeout(
          () => fallBack(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs
        );

        function onMessage(event: MessageEvent<WorkerResponse>) {
          const data = event.data;
          if (!data || data.id !== id) return;

          if (data.success) {
            if (data.data) {
              cleanup();
              resolve(data.data);
            } else if (typeof data.progress === "number") {
              onProgress?.(data.progress);
            }
          } else {
            cleanup();
            reject(new Error(data.error || `"${type}" operation failed`));
          }
        }

        function onError(event: ErrorEvent) {
          fallBack(event.error ?? new Error(event.message));
        }

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);

        try {
          worker.postMessage({ type, payload, id });
        } catch (error) {
          fallBack(error);
        }
      });
    } catch (error) {
      console.warn(`[pdf] Worker "${type}" threw, using main thread:`, error);
      disposeWorker();
      workerUnavailable = true;
    }
  }

  return runOnMainThread(type, payload, onProgress);
}

async function runOnMainThread<K extends OperationType>(
  type: K,
  payload: OperationPayloadMap[K],
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  // Imported on demand: pdf-lib is large, and pulling it in statically put it
  // in every tool route's initial bundle even before any file was chosen.
  const { runOperation } = await import("./pdfOps");
  return runOperation(type, payload, onProgress);
}
