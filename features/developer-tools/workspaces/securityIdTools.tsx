"use client";

/** Security, token & generator workspaces. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_BTN_PRIMARY_SOFT,
  RIBBON_INDENT_GROUP,
  RIBBON_KBD,
  RIBBON_MAIN_ACTION,
} from "@/components/tools/ribbonStyles";
import { downloadText } from "@/hooks/useDownload";
import { decodeJwt, type JwtDecoded } from "../engines/jwtEngine";
import { decryptText, encryptText, parseEnvelopeString, toEnvelopeString, generateToken, uuidV4, uuidV7, uuidV7Timestamp, nanoId, type TokenFormat } from "../engines/cryptoEngine";

const SLOT = "tool-ribbon-slot";

/* ------------------------------ JWT debugger ------------------------------- */

export function JwtWorkspace() {
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState<JwtDecoded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tab, setTab] = useState<"header" | "payload" | "signature">("payload");

  useEffect(() => {
    if (token.trim().length === 0) {
      setDecoded(null);
      setError(null);
      setWarnings([]);
      return;
    }
    const res = decodeJwt(token);
    if (res.ok) {
      setDecoded(res.token);
      setWarnings(res.warnings);
      setError(null);
    } else {
      setDecoded(null);
      setError(res.error);
      setWarnings([]);
    }
  }, [token]);

  const output = useMemo(() => {
    if (!decoded) return "";
    const target = tab === "header" ? decoded.header : tab === "payload" ? decoded.payload : decoded.signature;
    return tab === "signature" ? String(target ?? "—") : JSON.stringify(target, null, 2);
  }, [decoded, tab]);

  const ribbon = (
    <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => setToken(sampleJwt)} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample JWT</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setToken("");
            setDecoded(null);
            setError(null);
            setWarnings([]);
          }}
          className={RIBBON_BTN_CLEAR}
        >
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-error-container/30 text-error text-label-mono-md font-label-mono-md">
          <Icon name="warning" size={16} />
          <span>Decode-only — signature NOT verified</span>
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={token}
          onChange={setToken}
          title="JWT Token"
          chip="HEADER.PAYLOAD.SIGNATURE"
          placeholder="eyJhbGciOi… — paste a JWT; it never leaves this tab"
          errorMessage={error ?? undefined}
        />
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "header", icon: "code", label: "Header" },
                  { key: "payload", icon: "dataset", label: "Payload" },
                  { key: "signature", icon: "password", label: "Signature" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-label-mono-md font-label-mono-md ${
                    tab === t.key ? "bg-surface-container-high text-secondary font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <Icon name={t.icon} size={16} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <CopyButton value={output} />
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto leading-[22px]" style={{ height: 420 }}>
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold">{error}</p>
              </div>
            ) : decoded ? (
              <pre className="text-on-surface select-text overflow-x-auto">
                <code>{output}</code>
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="verified_user" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">Decode results appear here — nothing is transmitted anywhere.</p>
              </div>
            )}
          </div>
          {/* claim timeline status bar */}
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className={`flex items-center gap-2 min-w-0 ${decoded?.expired ? "text-error" : decoded ? "text-secondary" : "text-on-surface-variant"}`}>
              <Icon name={decoded?.expired ? "timer_off" : decoded ? "check_circle" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">
                {!decoded
                  ? "Awaiting token"
                  : decoded.expired
                    ? `Expired ${decoded.expiresAt?.toLocaleString()}`
                    : decoded.expiresAt
                      ? `Active until ${decoded.expiresAt?.toLocaleString()}`
                      : "No expiry claim"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
              {decoded?.algorithm && <span>alg: <span className="text-secondary font-semibold">{decoded.algorithm}</span></span>}
              {decoded?.issuedAt && <span>iat: {decoded.issuedAt.toLocaleString()}</span>}
              <span className="hidden lg:inline">100% Client Memory</span>
            </div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md">
          <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm flex items-center gap-2">
            <Icon name="info" size={18} className="text-tertiary" />
            Trust Notes
          </div>
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-label-mono-md font-label-mono-md text-on-surface-variant flex items-start gap-2">
                <Icon name="warning" size={14} className="text-tertiary mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usePortalRibbon(ribbon)}
    </>
  );
}

const sampleJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkJhYnkgR290IFRvb2xzIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxODAwMDAwMDAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

/* --------------------------- Encrypt & decrypt ----------------------------- */

export function EncryptWorkspace() {
  const [plaintext, setPlaintext] = useState("");
  const [password, setPassword] = useState("");
  const [cipher, setCipher] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doEncrypt = async () => {
    setError(null);
    if (plaintext.trim().length === 0) return setError("Enter plaintext to encrypt.");
    if (password.length === 0) return setError("Enter a password.");
    try {
      const parts = await encryptText(plaintext, password);
      setCipher(toEnvelopeString(parts));
      dispatchLatency();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encryption failed.");
    }
  };

  const doDecrypt = async () => {
    setError(null);
    if (cipher.trim().length === 0) return setError("Paste an encrypted payload to decrypt.");
    const parsed = parseEnvelopeString(cipher);
    if (!parsed.ok) return setError(parsed.error);
    try {
      const started = performance.now();
      const text = await decryptText(parsed.salt, parsed.iv, parsed.ciphertext, password);
      const ms = performance.now() - started;
      dispatchLatency(ms);
      setResult(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed.");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor value={plaintext} onChange={setPlaintext} title="Plaintext / Envelope" chip="AES-256-GCM BGT-1" placeholder="Plaintext to encrypt, or a BGT1 envelope to decrypt" minHeight={200} />
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Password</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">PBKDF2 600k • never transmitted</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline-variant"
              placeholder="•••••••• — kept in RAM only"
              aria-label="Encryption password"
            />
            <div className="flex items-center gap-space-xs">
              <button type="button" onClick={() => void doEncrypt()} className={RIBBON_MAIN_ACTION}>
                <Icon name="enhanced_encryption" size={16} />
                <span>Encrypt</span>
              </button>
              <button type="button" onClick={() => void doDecrypt()} className={RIBBON_BTN_PRIMARY_SOFT}>
                <Icon name="lock_open" size={16} />
                <span>Decrypt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaintext("");
                  setCipher("");
                  setResult("");
                  setPassword("");
                  setError(null);
                }}
                className={RIBBON_BTN_CLEAR}
              >
                <Icon name="delete_sweep" size={16} />
                <span>Clear</span>
              </button>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md flex-1 overflow-auto leading-[22px]" style={{ height: 190 }}>
            {error ? (
              <span className="text-error flex items-center gap-2">
                <Icon name="error" size={16} />
                {error}
              </span>
            ) : cipher || result ? (
              <div className="space-y-space-sm">
                {cipher && (
                  <div>
                    <div className="text-on-surface-variant mb-1">Encrypted envelope</div>
                    <div className="bg-surface-container p-space-sm rounded-lg text-primary break-all">{cipher}</div>
                    <div className="mt-1 flex items-center gap-1">
                      <CopyButton value={cipher} iconOnly />
                    </div>
                  </div>
                )}
                {result && (
                  <div>
                    <div className="text-on-surface-variant mb-1">Decrypted plaintext</div>
                    <div className="bg-surface-container p-space-sm rounded-lg text-secondary whitespace-pre-wrap">{result}</div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-on-surface-variant">Results appear here — wrong passwords fail loudly (authenticated encryption).</span>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            <span className="flex items-center gap-2 text-tertiary">
              <Icon name="shield" size={16} />
              <span className="font-semibold">Zero-knowledge: password &amp; plaintext never leave this tab</span>
            </span>
            <span>Fresh salt + IV per operation</span>
          </div>
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            Format: BGT1.&lt;salt b64&gt;.&lt;iv b64&gt;.&lt;ciphertext b64&gt; — portable between devices.
          </span>
        </div>
      )}
    </>
  );
}

function dispatchLatency(ms?: number) {
  if (typeof window !== "undefined" && ms !== undefined) {
    window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: ms }));
  }
}

/* ------------------------------ Token generator ----------------------------- */

export function TokenWorkspace() {
  const [format, setFormat] = useState<TokenFormat>("hex");
  const [length, setLength] = useState(32);
  const [count, setCount] = useState(5);
  const [tokens, setTokens] = useState<string[]>([]);

  const generate = useCallback(() => {
    const started = performance.now();
    const list = Array.from({ length: Math.max(1, Math.min(count, 50)) }, () => generateToken(format, Math.max(8, Math.min(length, 256))));
    dispatchLatency(performance.now() - started);
    setTokens(list);
  }, [format, length, count]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="font-headline-md text-headline-md text-on-surface mb-space-md">Generation Controls</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Format</span>
            <div className={`${RIBBON_INDENT_GROUP} mt-1 w-full justify-between`}>
              {(
                [
                  { label: "Hex", value: "hex" },
                  { label: "Base64URL", value: "base64url" },
                  { label: "Alphanumeric", value: "alphanumeric" },
                ] as const
              ).map((o) => (
                <button key={o.value} type="button" onClick={() => setFormat(o.value)} className={`flex-1 ${format === o.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Length ({length})</span>
            <input type="range" min={8} max={256} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-secondary)]" />
          </label>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Count ({count})</span>
            <input type="range" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-secondary)]" />
          </label>
        </div>
        <div className="mt-space-md flex items-center gap-space-xs">
          <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
            <Icon name="bolt" size={16} />
            <span>Generate Tokens</span>
          </button>
          <CopyButton value={tokens.join("\n")} label="Copy All" />
          <DownloadButton value={tokens.join("\n")} filename="baby-got-tools-tokens.txt" label="Download .txt" />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">{tokens.length} tokens • CSPRNG • rejection sampling (zero modulo bias)</span>
          <span>{tokens.length > 0 ? `${tokens[0]!.length} chars each` : "—"}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md space-y-1 max-h-[420px] overflow-auto">
          {tokens.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Icon name="password" size={32} className="text-outline-variant" />
              <span className="text-on-surface-variant font-body-sm text-body-sm">Press “Generate Tokens” — secrets appear here.</span>
            </div>
          ) : (
            tokens.map((t, i) => (
              <div key={`${t}-${i}`} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container/40">
                <code className="font-label-mono-md text-label-mono-md text-primary break-all">{t}</code>
                <CopyButton value={t} iconOnly />
              </div>
            ))
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">crypto.getRandomValues() only — Math.random() is never used.</span>
        </div>
      )}
    </>
  );
}

/* ------------------------------ UUID generator ------------------------------ */

export function UuidWorkspace() {
  const [kind, setKind] = useState<"v4" | "v7" | "nano">("v4");
  const [count, setCount] = useState(10);
  const [nanoLen, setNanoLen] = useState(21);
  const [rows, setRows] = useState<{ id: string; ts?: string }[]>([]);

  const generate = useCallback(() => {
    const started = performance.now();
    const n = Math.max(1, Math.min(count, 1000));
    const list = Array.from({ length: n }, (_, i) => {
      if (kind === "v4") return { id: uuidV4() };
      if (kind === "v7") {
        const id = uuidV7(Date.now() + i);
        return { id, ts: uuidV7Timestamp(id)?.toLocaleString() };
      }
      return { id: nanoId(nanoLen) };
    });
    dispatchLatency(performance.now() - started);
    setRows(list);
  }, [kind, count, nanoLen]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="font-headline-md text-headline-md text-on-surface mb-space-md">Generation Controls — CSPRNG-backed</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Identifier</span>
            <div className={`${RIBBON_INDENT_GROUP} mt-1 w-full justify-between`}>
              {(
                [
                  { label: "UUID v4", value: "v4" },
                  { label: "UUID v7", value: "v7" },
                  { label: "NanoID", value: "nano" },
                ] as const
              ).map((o) => (
                <button key={o.value} type="button" onClick={() => setKind(o.value)} className={`flex-1 ${kind === o.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Quantity ({count})</span>
            <input type="range" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-secondary)]" />
          </label>
          {kind === "nano" && (
            <label className="block">
              <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">NanoID Length ({nanoLen})</span>
              <input type="range" min={6} max={128} value={nanoLen} onChange={(e) => setNanoLen(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-secondary)]" />
            </label>
          )}
        </div>
        <div className="mt-space-md flex flex-wrap items-center gap-space-xs">
          <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
            <Icon name="fingerprint" size={16} />
            <span>Generate IDs</span>
          </button>
          <CopyButton value={rows.map((r) => r.id).join("\n")} label="Copy All" />
          <DownloadButton value={rows.map((r) => r.id).join("\n")} filename="baby-got-tools-ids.txt" label="Download .txt" />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">{rows.length} identifiers • all unique within a batch</span>
          <span>{kind === "v7" ? "Timestamped • B-Tree friendly" : kind === "v4" ? "RFC 4122 v4" : "URL-safe alphabet"}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md space-y-1 max-h-[420px] overflow-auto">
          {rows.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Icon name="fingerprint" size={32} className="text-outline-variant" />
              <span className="text-on-surface-variant font-body-sm text-body-sm">Press “Generate IDs” — fresh identifiers appear here.</span>
            </div>
          ) : (
            rows.map((r, i) => (
              <div key={`${r.id}-${i}`} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container/40 gap-2">
                <div className="min-w-0">
                  <code className="font-label-mono-md text-label-mono-md text-primary break-all">{r.id}</code>
                  {r.ts && <div className="text-label-mono-xs font-label-mono-xs text-outline-variant">minted {r.ts}</div>}
                </div>
                <CopyButton value={r.id} iconOnly />
              </div>
            ))
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">v4 = random • v7 = 48-bit ms timestamp + random tail (RFC 9562) • NanoID = 64-char alphabet</span>
        </div>
      )}
    </>
  );
}

export function UuidV7Workspace() {
  const [count, setCount] = useState(50);
  const [rows, setRows] = useState<{ id: string; ts: string }[]>([]);

  const generate = useCallback(() => {
    const started = performance.now();
    const n = Math.max(1, Math.min(count, 500));
    const list = Array.from({ length: n }, (_, i) => {
      const id = uuidV7(Date.now() + i);
      return { id, ts: uuidV7Timestamp(id)?.toISOString() ?? "" };
    });
    dispatchLatency(performance.now() - started);
    setRows(list);
  }, [count]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="font-headline-md text-headline-md text-on-surface mb-space-md">Batch Controls — RFC 9562 Complaint v7</div>
        <label className="block max-w-md">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Batch Size ({count})</span>
          <input type="range" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-primary)]" />
        </label>
        <div className="mt-space-md flex flex-wrap items-center gap-space-xs">
          <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
            <Icon name="pin" size={16} />
            <span>Generate Batch</span>
          </button>
          <CopyButton value={rows.map((r) => r.id).join("\n")} label="Copy All" />
          <DownloadButton value={rows.map((r) => r.id).join("\n")} filename="baby-got-tools-uuid-v7.txt" label="Download .txt" />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">{rows.length} v7 identifiers • chronological ordering preserved</span>
          <span>version bits 0111 • variant 10xx</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md space-y-1 max-h-[460px] overflow-auto">
          {rows.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Icon name="pin" size={32} className="text-outline-variant" />
              <span className="text-on-surface-variant font-body-sm text-body-sm">Press “Generate Batch” — timestamped IDs appear here.</span>
            </div>
          ) : (
            rows.map((r, i) => (
              <div key={`${r.id}-${i}`} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container/40 gap-2">
                <div className="min-w-0">
                  <code className="font-label-mono-md text-label-mono-md text-primary break-all">{r.id}</code>
                  <div className="text-label-mono-xs font-label-mono-xs text-outline-variant">ts: {r.ts}</div>
                </div>
                <CopyButton value={r.id} iconOnly />
              </div>
            ))
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">48-bit millisecond timestamp keeps B-Tree inserts sequential — no random page splits.</span>
        </div>
      )}
    </>
  );
}

/** Shared hero-ribbon portal hook (no-op on the server). */
export function usePortalRibbon(node: React.ReactNode) {
  const [portal, setPortal] = useState<React.ReactNode>(null);
  useEffect(() => {
    const slot = document.getElementById(SLOT);
    if (slot) setPortal(createPortal(node, slot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return portal;
}
