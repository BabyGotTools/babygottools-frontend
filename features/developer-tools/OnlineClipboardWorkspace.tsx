"use client";

/* Online Clipboard — beam text between devices via a short access code.
 * UI language mirrors the flagship workspace: dual-pane IDE look, iOS-grade
 * tokens, light/dark both driven by the same classes. The only network call
 * is the relay exchange with the platform backend (anonymous, no accounts,
 * no IPs; messages self-delete server-side after the TTL). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";
import { usePortalRibbon } from "@/features/developer-tools/workspaces/securityIdTools";
import type { DevTool } from "@/data/devToolTypes";

/* ------------------------------- API service ------------------------------- */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code: string; message: string } };

async function clipboardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Clipboard service isn't reachable — start the Baby Got Tools backend and try again.");
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json?.ok) {
    const message =
      json && !json.ok && json.error?.message ? json.error.message : "Relay error — please try again.";
    throw new Error(message);
  }
  return json.data;
}

interface ClipboardSent {
  accessCode: string;
  expiresAt: string;
}
interface ClipboardFetched {
  content: string;
  expiresAt: string;
}

const MAX = 5000;
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 6);
}

/* ------------------------------- countdown -------------------------------- */

function useSecondsLeft(expiresAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const target = Date.parse(expiresAt);
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

function fmtCountdown(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TimerChip({ expiresAt }: { expiresAt: string }) {
  const left = useSecondsLeft(expiresAt);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high text-secondary text-label-mono-xs font-label-mono-xs select-none">
      <Icon name="timer" size={12} />
      <span>{left !== null && left > 0 ? `${fmtCountdown(left)} left` : "expired"}</span>
    </span>
  );
}

/* ------------------------------- UI bits ---------------------------------- */

const CODE_TILE =
  "w-9 h-12 sm:w-11 sm:h-14 grid place-items-center rounded-lg bg-surface-container-high border border-outline-variant text-on-surface font-label-mono-lg font-label-mono-lg text-secondary select-text";

function CopyIconButton({
  label,
  text,
  size = 18,
}: {
  label: string;
  text: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else document.execCommand("copy"); // last-resort fallback
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard permission denied — best effort only */
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={
        copied
          ? "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-tertiary/15 text-tertiary text-label-mono-md font-label-mono-md transition-all cursor-pointer"
          : "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:text-secondary hover:bg-surface-container-highest text-label-mono-md font-label-mono-md transition-all cursor-pointer"
      }
    >
      <Icon name={copied ? "check_circle" : "content_copy"} size={size} />
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}

function InlineError({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 bg-error-container/30 text-error rounded-lg px-space-sm py-2 text-body-sm font-body-sm"
    >
      <Icon name="error" size={15} />
      <span>{error}</span>
    </div>
  );
}

/* -------------------------------- workspace ------------------------------- */

export default function OnlineClipboardWorkspace({ tool }: { tool: DevTool }) {
  void tool;
  const [tab, setTab] = useState<"send" | "receive">("send");

  /* ---------- send side ---------- */
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<ClipboardSent | null>(null);

  /* ---------- receive side ---------- */
  const [code, setCode] = useState("");
  const [retrieving, setRetrieving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [received, setReceived] = useState<ClipboardFetched | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const nearLimit = content.length / MAX >= 0.85;
  const atLimit = content.length >= MAX;
  const chars = content.length;

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > MAX) return;
    setSending(true);
    setSendError(null);
    try {
      const data = await clipboardFetch<ClipboardSent>("/clipboard", {
        method: "POST",
        body: JSON.stringify({ content: trimmed }),
      });
      setSent({ accessCode: data.accessCode, expiresAt: data.expiresAt });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Relay error — please try again.");
    } finally {
      setSending(false);
    }
  }, [content]);

  const handleRetrieve = useCallback(async (codeOverride?: string) => {
    const candidate = codeOverride ?? "";
    if (!CODE_RE.test(candidate) || candidate.length !== 6) return;
    setRetrieving(true);
    setReceiveError(null);
    try {
      const data = await clipboardFetch<ClipboardFetched>(`/clipboard/${encodeURIComponent(candidate)}`);
      setReceived({ content: data.content, expiresAt: data.expiresAt });
    } catch (e) {
      setReceiveError(e instanceof Error ? e.message : "Code not found or expired.");
    } finally {
      setRetrieving(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "receive" && code.length === 6 && CODE_RE.test(code) && !retrieving && !received) {
      handleRetrieve(code);
    }
  }, [tab, code, retrieving, received, handleRetrieve]);

  const onKeyDownSend = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  /* dual-column layout shares the flagship grid look */
  const dual = useMemo(() => {
    return tab === "send";
  }, [tab]);

  const ribbon = usePortalRibbon(
    <div className="mt-space-lg pt-space-md flex items-center gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
      <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
        Anonymous relay • 6-character CSPRNG code • server shreds messages automatically (no IPs, no accounts)
      </span>
    </div>
  );

  return (
    <>
      {/* segmented Send / Receive control */
      }
      <div className="flex justify-center mb-space-lg">
        <div
          className="flex items-center gap-1 bg-surface-container-highest p-1.5 rounded-2xl shadow-lg"
          role="tablist"
          aria-label="Clipboard mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "send"}
            onClick={() => setTab("send")}
            className={
              tab === "send"
                ? "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-container text-secondary text-label-mono-md font-label-mono-md font-semibold shadow-md cursor-pointer"
                : "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-on-surface-variant text-label-mono-md font-label-mono-md hover:text-on-surface transition-all cursor-pointer"
            }
          >
            <Icon name="send" size={16} />
            <span>Send</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "receive"}
            onClick={() => setTab("receive")}
            className={
              tab === "receive"
                ? "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-container text-tertiary text-label-mono-md font-label-mono-md font-semibold shadow-md cursor-pointer"
                : "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-on-surface-variant text-label-mono-md font-label-mono-md hover:text-on-surface transition-all cursor-pointer"
            }
          >
            <Icon name="move_to_inbox" size={16} />
            <span>Receive</span>
          </button>
        </div>
      </div>

      {dual ? (
        /* ============================== SEND ============================== */
        <div className="grid grid-cols-1 mb-space-lg">
          {!sent ? (
            <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/60 relative">
              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-md flex items-center justify-between gap-2 border-b border-outline-variant/40">
                <span className="font-headline-sm text-headline-sm text-on-surface">Paste your text</span>
                <span
                  className={`text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high ${
                    atLimit ? "text-error" : nearLimit ? "text-tertiary" : "text-on-surface-variant"
                  }`}
                >
                  {chars.toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>

              <div className="flex-1 bg-surface-container-lowest">
                <textarea
                  id="clipboard-text"
                  className="w-full h-64 lg:h-72 resize-none bg-transparent px-space-md lg:px-space-lg py-space-sm text-on-surface font-label-mono-md font-label-mono-md outline-none placeholder:text-outline"
                  placeholder="Type or paste anything…"
                  value={content}
                  maxLength={MAX}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX))}
                  onKeyDown={onKeyDownSend}
                  disabled={sending}
                />
              </div>

              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm text-label-mono-xs font-label-mono-xs text-on-surface-variant border-t border-outline-variant/40">
                <span className="self-center sm:self-auto">beamed to any device with its 6-character code</span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high text-outline select-none">
                    Ctrl <Icon name="keyboard_return" size={12} />
                  </span>
                  <button
                    type="button"
                    id="send-btn"
                    onClick={handleSend}
                    disabled={sending || content.trim().length === 0}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-space-lg py-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-sm font-semibold font-label-mono-md font-label-mono-md transition-all shadow-lg cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <Icon name={sending ? "hourglass_empty" : "send"} size={18} />
                    <span>{sending ? "Sending…" : "Send Clipboard"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/60 relative">
              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-md flex items-center justify-between gap-2 border-b border-outline-variant/40">
                <span className="font-headline-sm text-headline-sm text-on-surface">Clipboard queued</span>
                <TimerChip expiresAt={sent.expiresAt} />
              </div>
              <div className="px-space-md lg:px-space-lg py-space-lg flex flex-col items-center gap-space-md bg-surface-container-lowest">
                <Icon name="task_alt" size={36} className="text-tertiary" />
                <span className="text-body-md font-body-md text-on-surface-variant">Your clipboard code</span>
                <div className="flex gap-space-sm" aria-label={`Access code ${sent.accessCode}`}>
                  {sent.accessCode.split("").map((ch, i) => (
                    <span key={i} className={CODE_TILE}>
                      {ch}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-space-sm mt-space-sm">
                  <CopyIconButton label="Copy Code" text={sent.accessCode} />
                  <button
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setContent("");
                      setSendError(null);
                      setTab("send");
                    }}
                    className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest text-label-mono-md font-label-mono-md transition-all cursor-pointer"
                  >
                    <Icon name="restart_alt" size={15} />
                    <span>Send another</span>
                  </button>
                </div>
                <p className="text-label-mono-xs font-label-mono-xs text-on-surface-variant text-center max-w-md">
                  Share this code with the receiver — it works right up until the timer runs out, then the
                  server shreds the message automatically.
                </p>
              </div>
            </div>
          )}
          {sendError && <div className="mt-space-sm">{<InlineError error={sendError} />}</div>}
        </div>
      ) : (
        /* ============================= RECEIVE ============================= */
        <div className="grid grid-cols-1 mb-space-lg">
          {!received ? (
            <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/60 relative">
              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-md border-b border-outline-variant/40">
                <span className="font-headline-sm text-headline-sm text-on-surface">Enter access code</span>
              </div>
              <div className="px-space-md lg:px-space-lg py-space-lg flex flex-col gap-space-md bg-surface-container-lowest">
                <input
                  ref={codeRef}
                  id="code-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="6-character access code"
                  className="w-72 max-w-full self-center text-center rounded-xl bg-surface-container-high border border-outline px-space-md py-4 text-on-surface text-2xl tracking-[0.35em] font-label-mono-lg font-label-mono-lg outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/25 focus:bg-surface-container-lowest transition-all placeholder:text-outline"
                  placeholder="A7K92B"
                  value={code}
                  maxLength={6}
                  onChange={(e) => {
                    setCode(normalizeCode(e.target.value));
                    if (receiveError) setReceiveError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRetrieve(code);
                  }}
                  disabled={retrieving}
                />
                <p className="text-label-mono-xs font-label-mono-xs text-on-surface-variant text-center">
                  6 characters — letters and digits only (codes never contain O, I, L, 0 or 1)
                </p>
                <button
                  type="button"
                  id="retrieve-btn"
                  onClick={() => handleRetrieve(code)}
                  disabled={retrieving || code.length < 6 || !CODE_RE.test(code)}
                  className="inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-sm font-semibold font-label-mono-md font-label-mono-md transition-all shadow-lg cursor-pointer disabled:opacity-60 disabled:pointer-events-none self-center"
                >
                  <Icon name={retrieving ? "hourglass_empty" : "move_to_inbox"} size={18} />
                  <span>{retrieving ? "Retrieving…" : "Retrieve Text"}</span>
                </button>
                <p className="text-label-mono-xs font-label-mono-xs text-on-surface-variant text-center">
                  auto-retrieves once all 6 characters are entered
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/60 relative">
              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-md flex items-center justify-between gap-2 border-b border-outline-variant/40">
                <span className="font-headline-sm text-headline-sm text-on-surface">Clipboard received</span>
                <TimerChip expiresAt={received.expiresAt} />
              </div>
              <div className="flex-1 bg-surface-container-lowest px-space-md lg:px-space-lg py-space-sm">
                <pre className="text-on-surface select-text font-label-mono-md font-label-mono-md whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto py-space-sm">
                  {received.content}
                </pre>
              </div>
              <div className="bg-surface-container-low px-space-md lg:px-space-lg py-space-sm flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/40">
                <CopyIconButton label="Copy Text" text={received.content} />
                <button
                  type="button"
                  onClick={() => {
                    setReceived(null);
                    setCode("");
                    setReceiveError(null);
                    window.setTimeout(() => codeRef.current?.focus(), 50);
                  }}
                  className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest text-label-mono-md font-label-mono-md transition-all cursor-pointer"
                >
                  <Icon name="restart_alt" size={15} />
                  <span>Enter another code</span>
                </button>
              </div>
            </div>
          )}
          {receiveError && <div className="mt-space-sm">{<InlineError error={receiveError} />}</div>}
        </div>
      )}

      {ribbon}
    </>
  );
}
