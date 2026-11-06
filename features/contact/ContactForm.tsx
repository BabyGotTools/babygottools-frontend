"use client";

import { useState } from "react";
import Icon from "@/components/common/Icon";

type Kind = "bug" | "idea" | "privacy" | "other";

/**
 * Contact form backed by the platform's opt-in feedback endpoint
 * (POST /api/v1/feedback). Email is optional; the API is rate-limited and
 * degrades gracefully when the optional backend is not running.
 */
export default function ContactForm() {
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 4) {
      setError("Please write at least a few words (4–2000 characters).");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      if (!res.ok) {
        // The API is an optional platform feature — explain honestly instead
        // of pretending something was delivered.
        setState("error");
        setError(
          "The message service isn't reachable right now (it's an optional backend feature). Please try again later."
        );
        return;
      }
      setState("sent");
      setMessage("");
      setEmail("");
    } catch {
      setState("error");
      setError(
        "The message service isn't reachable right now (it's an optional backend feature). Please try again later."
      );
    }
  }

  if (state === "sent") {
    return (
      <div className="bg-surface-container-low rounded-xl p-space-lg flex items-start gap-space-sm">
        <Icon name="check_circle" size={22} className="text-secondary shrink-0 mt-0.5" />
        <div>
          <p className="font-body-md text-body-md text-on-surface font-medium">Message received.</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Thanks! It&apos;s stored anonymously and expires automatically — we don&apos;t retain
            identities.
          </p>
        </div>
      </div>
    );
  }

  const kinds: { value: Kind; label: string }[] = [
    { value: "bug", label: "Bug report" },
    { value: "idea", label: "Idea / request" },
    { value: "privacy", label: "Privacy question" },
    { value: "other", label: "Other" },
  ];

  return (
    <form onSubmit={submit} className="space-y-space-md">
      <div>
        <label htmlFor="contact-kind" className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">
          Topic
        </label>
        <div className="flex flex-wrap gap-space-xs">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={`px-space-sm py-1.5 rounded-full font-label-sm text-label-sm transition-colors ${
                kind === k.value
                  ? "bg-primary text-on-primary font-semibold"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          required
          placeholder="What can we improve? Which tool? What did you expect?"
          className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant/60 px-space-sm py-space-xs font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none resize-y"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">
          Email <span className="text-outline">(optional — only if you want a reply)</span>
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant/60 px-space-sm py-space-xs font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="font-body-sm text-body-sm text-error flex items-center gap-1.5">
          <Icon name="error" size={16} />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Messages are stored anonymously (topic + text, and your email only if you provide it) and
        expire automatically. We don&apos;t log IPs and there are no cookies. See our{" "}
        <a href="/privacy" className="text-secondary hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
