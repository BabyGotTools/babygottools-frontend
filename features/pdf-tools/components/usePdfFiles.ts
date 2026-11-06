"use client";

import { useCallback, useRef, useState } from "react";
import type { LoadedPdfFile } from "../engines/pdfTypes";
import { getPdfPageCount } from "../engines/pdfRender";
import { totalBytesTooLarge } from "../engines/validation";

/**
 * File-tray state shared by every PDF workspace.
 *
 * Files are validated by magic bytes before they enter the tray; page counts
 * are parsed lazily and never block the tray from appearing.
 */

export type AcceptKind = "pdf" | "image" | "office" | "text";

const ACCEPT_ATTRS: Record<AcceptKind, string> = {
  pdf: "application/pdf,.pdf",
  image: "image/*,.heic,.heif,.avif",
  office: ".docx,.xlsx,.pptx",
  text: ".txt,.md,.markdown,.html,.htm,.csv",
};

export interface UsePdfFilesOptions {
  kind: AcceptKind;
  maxFiles?: number;
  /** Multi-file tools merge everything into one output; per-file caps differ. */
  maxTotalBytes?: number;
}

export function usePdfFiles({ kind, maxFiles = 20 }: UsePdfFilesOptions) {
  const [files, setFiles] = useState<LoadedPdfFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const idCounter = useRef(0);

  /**
   * Mirror of the committed tray, safe to read inside async callbacks — the
   * singular place where tray mutations and their guards are decided. State
   * updates never guard themselves from inside their own updater (which runs
   * twice under StrictMode and cannot reject a commit it already computed).
   */
  const filesRef = useRef<LoadedPdfFile[]>([]);

  const commit = useCallback(
    (update: LoadedPdfFile[] | ((current: LoadedPdfFile[]) => LoadedPdfFile[])) => {
      const next = typeof update === "function" ? update(filesRef.current) : update;
      filesRef.current = next;
      setFiles(next);
    },
    []
  );

  const addFiles = useCallback(
    async (incoming: File[] | FileList) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      // Reserve slots up front: over-limit files are never parsed.
      const room = Math.max(0, maxFiles - filesRef.current.length);
      const overLimit = list.length > room;
      if (room === 0) {
        setNotice(`This tool accepts up to ${maxFiles} files at a time.`);
        return;
      }

      const parsed: LoadedPdfFile[] = [];
      for (const file of list.slice(0, room)) {
        const head = new Uint8Array(
          await file.slice(0, 1024).arrayBuffer()
        );
        const check = await validateFile(kind, file, head);
        if (!check.ok) {
          setNotice(check.reason ?? "This file type is not accepted here.");
          continue;
        }

        const entry: LoadedPdfFile = {
          id: `pdf-file-${++idCounter.current}`,
          file,
          name: file.name,
          size: file.size,
          pageCount: 1,
        };

        if (kind === "pdf") {
          entry.pageCount = await safePageCount(file);
          entry.encrypted = await safeEncrypted(file);
          if (entry.encrypted) {
            entry.error =
              "Password-protected — remove the password before this tool can process it.";
          }
        }

        parsed.push(entry);
      }

      if (parsed.length > 0) {
        const combined = [...filesRef.current, ...parsed];
        if (totalBytesTooLarge(combined.reduce((sum, entry) => sum + entry.size, 0))) {
          setNotice("Combined files exceed the 500 MB in-memory budget. Remove some files and retry.");
          return;
        }
        setNotice(null);
        commit(combined);
      }
      if (overLimit) {
        setNotice(`This tool accepts up to ${maxFiles} files at a time — ${list.length - room} file(s) ignored.`);
      }
    },
    [kind, maxFiles, commit]
  );

  const removeFile = useCallback((id: string) => {
    commit((current) => current.filter((entry) => entry.id !== id));
  }, [commit]);

  const clearFiles = useCallback(() => commit([]), [commit]);

  const moveFile = useCallback((from: number, to: number) => {
    const current = filesRef.current;
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
      return;
    }
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    commit(next);
  }, [commit]);

  const duplicateFile = useCallback((index: number) => {
    const current = filesRef.current;
    if (index < 0 || index >= current.length || current.length >= maxFiles) {
      return;
    }
    const clone = { ...current[index]!, id: `pdf-file-${++idCounter.current}` };
    const next = [...current];
    next.splice(index + 1, 0, clone);
    commit(next);
  }, [maxFiles, commit]);

  const setFilesManually = useCallback(
    (updater: (current: LoadedPdfFile[]) => LoadedPdfFile[]) => {
      commit(updater);
    },
    [commit]
  );

  return {
    files,
    notice,
    setNotice,
    acceptAttr: ACCEPT_ATTRS[kind],
    addFiles,
    removeFile,
    clearFiles,
    moveFile,
    duplicateFile,
    setFilesManually,
  };
}

async function validateFile(
  kind: AcceptKind,
  file: File,
  head: Uint8Array
): Promise<{ ok: boolean; reason?: string }> {
  const mod = await import("../engines/validation");
  if (kind === "pdf") return mod.checkPdfFile(file, head);
  if (kind === "image") return mod.checkImageFile(file, head);
  if (kind === "office") return mod.checkOfficeFile(file, head);
  return mod.checkTextishFile(file, head);
}

async function safePageCount(file: File): Promise<number> {
  try {
    return await getPdfPageCount(file);
  } catch {
    return 0;
  }
}

async function safeEncrypted(file: File): Promise<boolean> {
  try {
    return await (await import("../engines/pdfRender")).isEncrypted(file);
  } catch {
    return false;
  }
}
