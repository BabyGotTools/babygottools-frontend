/**
 * Focused reproduction probe for the three "action button never became ready"
 * e2e failures (extract-pages, organize-pdf, delete-pages).
 * Starts the production server on :3178 and instruments each prep step.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SAMPLES = path.join(__dirname, "e2e-samples");
const PORT = 3178;
const BASE = `http://127.0.0.1:${PORT}`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buildSample() {
  fs.mkdirSync(SAMPLES, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`PAGE ${i} OF 3`, { x: 60, y: 700, size: 40, font, color: rgb(0.1, 0.15, 0.4) });
  }
  fs.writeFileSync(path.join(SAMPLES, "doc-3p.pdf"), await doc.save());
}

function startServer() {
  const server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, NODE_OPTIONS: "" },
    stdio: "ignore",
  });
  return server;
}

async function dumpButtons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => /WASM|Organized|Extract|Delete/.test(b.textContent || ""))
      .map((b) => ({
        label: (b.textContent || "").replace(/\s+/g, " ").trim(),
        disabled: b.disabled,
      }))
  );
}

async function dumpInputs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input[type="text"]')].map((i) => ({
      placeholder: i.placeholder,
      value: i.value,
      readOnly: i.readOnly,
    }))
  );
}

async function main() {
  await buildSample();
  const server = startServer();
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(BASE + "/", { redirect: "manual" });
      if (res.status < 500) break;
    } catch {}
    await sleep(500);
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-first-run", "--disable-extensions", "--hide-scrollbars"],
  });

  try {
    // ---- organize-pdf -------------------------------------------------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      page.on("pageerror", (e) => console.log("  [organize pageerror]", e.message));
      page.on("console", (m) => m.type() === "error" && console.log("  [organize console]", m.text()));
      await page.goto(`${BASE}/tools/organize-pdf`, { waitUntil: "load", timeout: 60000 });
      await page.waitForSelector('input[type="file"]', { timeout: 30000 });
      const input = await page.$('input[type="file"]');
      await input.uploadFile(path.join(SAMPLES, "doc-3p.pdf"));
      await sleep(700);
      console.log("[organize] inputs before click:", JSON.stringify(await dumpInputs(page)));
      const rotateSel = 'button[aria-label="Rotate page 1 by 90 degrees"]';
      await page.waitForSelector(rotateSel, { timeout: 30000 });
      const box = await (await page.$(rotateSel)).boundingBox();
      console.log("[organize] rotate btn box:", JSON.stringify(box));
      await page.click(rotateSel);
      for (let i = 0; i < 15; i++) {
        const buttons = await dumpButtons(page);
        const rot = await page.$$eval('[aria-label^="Rotate page"]', (els) => els.length);
        const done = buttons.some((b) => b.label.includes("Write Organized") && !b.disabled);
        if (i === 0 || i === 2 || i === 6 || done)
          console.log(`[organize] t+${i * 0.8}s rotBtns=${rot}`, JSON.stringify(buttons));
        if (done) { console.log("[organize] RESULT: enabled"); break; }
        await sleep(800);
      }
      // What does elementFromPoint say at the rotate button center?
      const at = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label^="Rotate page 1"]');
        if (!btn) return "gone";
        btn.scrollIntoView({ block: "center" });
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, top: el ? el.tagName + "." + (el.className || "").slice(0, 60) : "null", isSelf: el === btn || btn.contains(el) };
      });
      console.log("[organize] hit-test:", JSON.stringify(at));
      await page.close();
    }

    // ---- extract-pages ------------------------------------------------
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(`${BASE}/tools/extract-pages`, { waitUntil: "load", timeout: 60000 });
      await page.waitForSelector('input[type="file"]', { timeout: 30000 });
      const input = await page.$('input[type="file"]');
      await input.uploadFile(path.join(SAMPLES, "doc-3p.pdf"));
      await sleep(700);
      // click "Type Ranges"
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Type Ranges");
        if (!btn) return false;
        btn.click();
        return true;
      });
      console.log("[extract] clicked Type Ranges:", clicked);
      console.log("[extract] inputs now:", JSON.stringify(await dumpInputs(page)));
      // type into the workspace range input (placeholder-scoped)
      await page.waitForSelector('input[type="text"][placeholder^="1-3"]', { timeout: 10000 });
      await page.type('input[type="text"][placeholder^="1-3"]', "1, 3", { delay: 5 });
      await sleep(300);
      console.log("[extract] inputs after type:", JSON.stringify(await dumpInputs(page)));
      const buttons = await dumpButtons(page);
      console.log("[extract] buttons:", JSON.stringify(buttons));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    server.kill("SIGTERM");
    spawn("cmd", ["/c", `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /f /pid %a`], { shell: true, stdio: "ignore" });
  }
}

main().catch((e) => { console.error("[probe fatal]", e); process.exitCode = 1; });
