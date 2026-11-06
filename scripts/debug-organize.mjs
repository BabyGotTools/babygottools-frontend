/**
 * Second probe: instrument click delivery on the organize-pdf rotate button.
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
const PORT = 3179;
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
  return spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, NODE_OPTIONS: "" },
    stdio: "ignore",
  });
}

async function ready(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/tools/organize-pdf`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector('input[type="file"]', { timeout: 30000 });
  const input = await page.$('input[type="file"]');
  await input.uploadFile(path.join(SAMPLES, "doc-3p.pdf"));
  await sleep(700);
  await page.waitForSelector('button[aria-label="Rotate page 1 by 90 degrees"]', { timeout: 30000 });
  // click spy
  await page.evaluate(() => {
    window.__spy = [];
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest?.('button[aria-label^="Rotate page 1"]');
        window.__spy.push({
          target: e.target.tagName + "." + String(e.target.className || "").slice(0, 40),
          onRotateBtn: Boolean(btn),
          detail: e.detail,
        });
      },
      true
    );
  });
  return page;
}

async function state(page) {
  return page.evaluate(() => {
    const meta = document.body.textContent || "";
    const m = meta.match(/(\d+) rotated/);
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Write Organized"));
    return { rotated: m ? m[1] : "?", runDisabled: btn ? btn.disabled : "none", spy: window.__spy };
  });
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
    // 1) real coordinate click
    {
      const page = await ready(browser);
      await page.click('button[aria-label="Rotate page 1 by 90 degrees"]');
      await sleep(1200);
      console.log("[coord-click]", JSON.stringify(await state(page)));
      await page.close();
    }
    // 2) evaluate btn.click()
    {
      const page = await ready(browser);
      await page.evaluate(() => {
        document.querySelector('button[aria-label="Rotate page 1 by 90 degrees"]').click();
      });
      await sleep(1200);
      console.log("[js-click]", JSON.stringify(await state(page)));
      await page.close();
    }
    // 3) dispatched bubbling MouseEvent
    {
      const page = await ready(browser);
      await page.evaluate(() => {
        const b = document.querySelector('button[aria-label="Rotate page 1 by 90 degrees"]');
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      });
      await sleep(1200);
      console.log("[dispatch-click]", JSON.stringify(await state(page)));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    server.kill("SIGTERM");
    spawn("cmd", ["/c", `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /f /pid %a`], { shell: true, stdio: "ignore" });
  }
}

main().catch((e) => { console.error("[probe fatal]", e); process.exitCode = 1; });
