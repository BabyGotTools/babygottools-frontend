export interface SanitizedHtml {
  html: string;
  css: string;
  warnings: string[];
}

/**
 * HTML sanitation for both the preview iframe and the conversion container.
 *
 * The preview iframe is additionally sandboxed with no permissions, so this is
 * the second line of defence rather than the only one. Scripts, event
 * handlers, forms, frames and every network-bearing URL are removed so a
 * pasted document can never phone home while it is being converted.
 */

const FORBIDDEN_TAGS = [
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta",
  "link",
  "base",
  "audio",
  "video",
  "source",
  "track",
  "foreignObject",
];

const FORBIDDEN_ATTRS = [
  "srcdoc",
  "formaction",
  "action",
  "ping",
  "http-equiv",
  "srcset",
];

const SAFE_URL = /^(data:|blob:|#)/i;

export function sanitizeCss(css: string): string {
  return css
    .replace(/<\/style/gi, "")
    .replace(/@import[^;]+;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(
      /url\(\s*(['"]?)(?:(?:https?:)?\/\/|file:)[^)]*\)/gi,
      "none"
    );
}

function hasRemoteUrl(value: string): boolean {
  if (!value) return false;
  if (/url\(\s*(['"]?)(?:(?:https?:)?\/\/|file:)/i.test(value)) return true;
  return false;
}

export async function sanitizeHtml(raw: string): Promise<SanitizedHtml> {
  const warnings: string[] = [];
  if (!raw.trim()) return { html: "", css: "", warnings: ["The HTML is empty"] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  const scriptCount = doc.querySelectorAll("script").length;
  const frameCount = doc.querySelectorAll(
    "iframe, frame, frameset, object, embed, applet"
  ).length;
  const formCount = doc.querySelectorAll(
    "form, input, button, textarea, select, option"
  ).length;
  const eventHandlerCount = (raw.match(/\son[a-z]+\s*=/gi) ?? []).length;

  const styles = Array.from(doc.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");
  const css = sanitizeCss(styles);

  doc.querySelectorAll("style").forEach((el) => el.remove());

  const bodyHtml = doc.body?.innerHTML ?? "";
  const { default: DOMPurify } = await import("dompurify");

  const clean = DOMPurify.sanitize(bodyHtml, {
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTRS,
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target"],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true, svg: true },
  });

  const container = document.createElement("div");
  container.innerHTML = clean;

  let externalAssets = 0;
  let inlineStylesCleaned = 0;

  container.querySelectorAll("*").forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (
        name === "href" &&
        /^\s*(javascript|vbscript|data:text\/html)/i.test(value)
      ) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (["src", "poster", "background"].includes(name)) {
        if (!SAFE_URL.test(value.trim())) {
          element.removeAttribute(attr.name);
          externalAssets += 1;
        }
        continue;
      }

      if (name === "style") {
        const safe = sanitizeCss(value);
        if (safe !== value) inlineStylesCleaned += 1;
        if (hasRemoteUrl(value)) externalAssets += 1;
        element.setAttribute("style", safe);
      }
    }
  });

  if (scriptCount > 0) {
    warnings.push(`${scriptCount} script tag${scriptCount === 1 ? "" : "s"} removed`);
  }
  if (frameCount > 0) {
    warnings.push(
      `${frameCount} embedded frame${frameCount === 1 ? "" : "s"} removed`
    );
  }
  if (formCount > 0) {
    warnings.push(
      `${formCount} form control${formCount === 1 ? "" : "s"} removed`
    );
  }
  if (eventHandlerCount > 0) {
    warnings.push("Unsafe event handlers were removed");
  }
  if (externalAssets > 0) {
    warnings.push(
      `${externalAssets} external image or resource${externalAssets === 1 ? "" : "s"} removed to keep conversion private`
    );
  }
  if (inlineStylesCleaned > 0) {
    warnings.push("Remote CSS resources were removed");
  }

  return { html: container.innerHTML.trim(), css, warnings };
}
