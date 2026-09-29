// Video DIRECTOR — the filming API for the vertical short videos (TikTok / Reels /
// WhatsApp) of this game. A scene (test/video/scenes/<name>.video.ts) boots the real game
// in a portrait window, then films only the moments that matter:
//
//   const d = await Director.start(page, 'gore', { title: 'BRUTAL GORE', tod: .42 });
//   await d.clip('headshot', 'ONE BULLET. ONE HEAD.', async () => { ... });  // kept
//   await d.walkTo(...);                                                     // cut out
//   d.cover();                                   // (inside a clip) this frame = the cover
//   await d.finish();
//
// Frames stream from Chrome's screencast (JPEG + real timestamps) and are written ONLY
// while a clip is rolling, so everything between clips (walking, setup) is cut by
// construction. test/video/make-video.mjs then builds the 9:16 30 fps MP4 + cover.
// See .claude/skills/record-video/SKILL.md for the full workflow.
import type { Page, CDPSession } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export interface SceneOptions {
  title: string;          // cover headline (big, 1-4 words)
  subtitle?: string;      // cover line under it
  outro?: string;         // end-card line (default: the game's name)
  tod?: number;           // time of day 0..1 (0.42 = bright late morning)
  settings?: Record<string, unknown>; // extra graphics settings (localStorage)
  hide?: string[];        // CSS selectors hidden while filming (default: the police radio subtitle)
}
interface Clip { label: string; caption?: string; start: number; end: number }
interface Frame { file: string; t: number }

export const OUT_ROOT = 'output/video';
type Pt = { x: number; z: number };

export class Director {
  readonly page: Page;
  private cdp!: CDPSession;
  private dir: string;
  private frames: Frame[] = [];
  private clips: Clip[] = [];
  private rolling = false;
  private coverAt: number | null = null;
  private n = 0;

  private constructor(page: Page, private name: string, private opts: SceneOptions) {
    this.page = page;
    this.dir = path.join(OUT_ROOT, name);
  }

  /** Boot the game for filming (clean HUD, chosen light) and arm the recorder. */
  static async start(page: Page, name: string, opts: SceneOptions): Promise<Director> {
    const d = new Director(page, name, opts);
    fs.rmSync(d.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(d.dir, 'frames'), { recursive: true });
    await page.addInitScript((extra) => {
      try { localStorage.setItem('tinygta_settings', JSON.stringify({ fps: false, ...extra })); } catch { /* ignore */ }
    }, opts.settings ?? {});
    await page.addInitScript((sel: string[]) => {
      const css = sel.map((q) => `${q}{display:none!important}`).join('');
      const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    }, opts.hide ?? ['#police-radio']);
    page.on('pageerror', (e) => { if (!/Pointer Lock/i.test(e.message)) console.error('[pageerror]', e.message); });
    await page.goto(`/?tod=${opts.tod ?? .42}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!(window as any).render_game_to_text
      && JSON.parse((window as any).render_game_to_text()).started === true, null, { timeout: 90_000 });
    // screencast runs the whole time; frames are only KEPT while a clip rolls
    d.cdp = await page.context().newCDPSession(page);
    d.cdp.on('Page.screencastFrame', async (f: any) => {
      if (d.rolling) {
        const file = `f${String(d.n++).padStart(5, '0')}.jpg`;
        fs.writeFileSync(path.join(d.dir, 'frames', file), Buffer.from(f.data, 'base64'));
        d.frames.push({ file, t: f.metadata.timestamp });
      }
      await d.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await d.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
    await d.wait(2000); // let the world settle / warm up before any clip
    return d;
  }

  // ---------------- filming ----------------
  /** Film `fn` as one kept clip with an on-screen caption. `tail` keeps rolling a bit after. */
  async clip(label: string, caption: string | undefined, fn: () => Promise<void>, tail = 350): Promise<void> {
    const start = Date.now() / 1000;
    this.rolling = true;
    try { await fn(); await this.wait(tail); }
    finally { this.rolling = false; }
    this.clips.push({ label, caption, start, end: Date.now() / 1000 });
  }
  /** Mark the current moment (inside a clip) as the cover frame. */
  cover(): void { this.coverAt = Date.now() / 1000; }

  async finish(): Promise<string> {
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.wait(200);
    const capture = { name: this.name, ...this.opts, clips: this.clips, frames: this.frames, coverAt: this.coverAt };
    const file = path.join(this.dir, 'capture.json');
    fs.writeFileSync(file, JSON.stringify(capture, null, 1));
    const secs = this.clips.reduce((a, c) => a + (c.end - c.start), 0);
    console.log(`[video] ${this.name}: ${this.clips.length} clips, ${secs.toFixed(1)} s kept, ${this.frames.length} frames -> ${file}`);
    return file;
  }

  // ---------------- game control ----------------
  wait(ms: number) { return this.page.waitForTimeout(ms); }
  ev<R>(fn: (arg: any) => R, arg?: unknown): Promise<R> { return this.page.evaluate(fn as any, arg) as Promise<R>; }
  async snap(): Promise<any> { return JSON.parse(await this.ev(() => (window as any).render_game_to_text())); }
  async pos(): Promise<Pt> { const s = await this.snap(); return { x: s.player.x, z: s.player.z }; }
  /** Place the player at `p` looking at `f` (instant — do it between clips). */
  teleport(p: Pt, f: Pt) { return this.ev(([a, b]: any) => (window as any).__test.teleport(a.x, a.z, b.x, b.z), [p, f]); }
  key(code: string, down: boolean) { return this.ev(([c, d]: any) => (window as any).__test.setKey(c, d), [code, down]); }
  async hold(code: string, ms: number) { await this.key(code, true); await this.wait(ms); await this.key(code, false); }
  interact() { return this.ev(() => (window as any).__test.interact()); }
  attack() { return this.ev(() => (window as any).__test.attack()); }
  giveGun() { return this.ev(() => (window as any).__test.giveGun()); }
  equip(id: string) { return this.ev((w: string) => (window as any).__test.equipWeapon(w), id); }
  /** Stand `dist` m from the nearest pedestrian aiming at 'head' | 'body' | 'legs'. */
  aimAtNpc(dist: number, part: 'head' | 'body' | 'legs' = 'body') {
    return this.ev(([d, p]: any) => (window as any).__test.aimAtNpc(d, p), [dist, part]) as Promise<{ name: string } | null>;
  }
  /** Weed farm test hook ('stock' | 'ripen' | 'grow:<s>' | 'state' …). */
  farm(cmd: string) { return this.ev((c: string) => (window as any).__test.farm(c), cmd) as Promise<any>; }

  /** Smooth pan of the first-person view toward `f` (keeps the position). */
  async turnTo(f: Pt, ms = 600): Promise<void> {
    const p = await this.pos(); const s = await this.snap();
    const y0 = s.player.heading ?? 0, y1 = Math.atan2(f.x - p.x, f.z - p.z);
    let d = y1 - y0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const n = Math.max(1, Math.round(ms / 33));
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = k * k * (3 - 2 * k), y = y0 + d * e;
      await this.teleport(p, { x: p.x + Math.sin(y), z: p.z + Math.cos(y) });
      await this.wait(33);
    }
  }
  /** Walk with real input toward `to` (DOOM speed: let go early and glide), then snap onto it. */
  async walkTo(to: Pt, stop = .3): Promise<void> {
    await this.turnTo(to, 400);
    await this.key('KeyW', true);
    let last = 1e9;
    for (let i = 0; i < 300; i++) {
      const p = await this.pos();
      const d = Math.hypot(p.x - to.x, p.z - to.z);
      if (d < stop + 1.1 || d > last + .02) break;
      last = d;
      await this.wait(10);
    }
    await this.key('KeyW', false);
    await this.wait(450);
    const p = await this.pos(), s = await this.snap();
    if (Math.hypot(p.x - to.x, p.z - to.z) > stop) {
      const h = s.player.heading ?? 0;
      await this.teleport(to, { x: to.x + Math.sin(h), z: to.z + Math.cos(h) });
    }
  }
  /** Press E and wait for the farm hands to finish their clip. */
  async farmAct(): Promise<void> {
    await this.interact();
    await this.page.waitForFunction(() => !(window as any).__test.farm('state').busy, null, { timeout: 10_000 });
  }
}
