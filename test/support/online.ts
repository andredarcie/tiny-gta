// ============================================================================
// Two-player (N-player) online harness for Tiny Crime.
//
// Boots one game window per nickname, each in its OWN browser context — so each
// gets isolated localStorage and therefore a distinct player id (tinygta_pid) —
// and points all of them at the LOCAL multiplayer server. In a dev build the
// client connects to ws://<host>:8787/ws automatically (js/net/online.ts
// wsUrl()), which is exactly the wrangler dev server that
// playwright.online.config.ts starts on :8787.
//
// Each window is driven by the same single-player GameDriver (test/support/
// game.ts); this file only adds the multi-window setup + a couple of online
// conveniences. The nickname is seeded into localStorage before boot so the
// localhost auto-start adopts it (see js/core/input.ts), giving every window a
// distinct, assertable name.
//
// Requires the local MP server on :8787 — run via `npm run test:online` (which
// uses playwright.online.config.ts). See test/ONLINE_TESTING.md.
// ============================================================================
import { type Browser, type BrowserContext } from '@playwright/test';
import { GameDriver } from './game.ts';

export interface OnlinePlayer {
  driver: GameDriver;
  context: BrowserContext;
  nick: string;
}

/** Boot one game window per nick as a distinct online player, then wait until
 * every window has JOINED the shared world and can see all the others. */
export async function bootOnlinePlayers(browser: Browser, nicks: string[]): Promise<OnlinePlayer[]> {
  const players: OnlinePlayer[] = [];
  for (const nick of nicks) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    // Seed the nickname BEFORE any game script runs; the localhost auto-start
    // honors tinygta_nick (js/core/input.ts) so each window is a named player.
    await page.addInitScript((n) => { try { localStorage.setItem('tinygta_nick', n); } catch { /* ignore */ } }, nick);
    const driver = new GameDriver(page);
    await driver.boot();
    players.push({ driver, context, nick });
  }
  // (1) every window connects + joins the shared world...
  for (const p of players) {
    await p.driver.waitForState(
      (s: any) => !!s.online && s.online.phase === 'joined',
      { timeout: 45_000, message: `${p.nick} never joined the online world (is the :8787 MP server up?)` });
  }
  // (2) ...and sees the other N-1 players.
  const others = nicks.length - 1;
  for (const p of players) {
    await p.driver.page.waitForFunction(
      (n) => { const s = JSON.parse((window as any).render_game_to_text()); return !!s.online && s.online.remotes >= n; },
      others, { timeout: 45_000 });
  }
  return players;
}

/** The remote-avatar entry a player currently sees for `nick` (from the
 * render_game_to_text `onlineRemotes` introspection), or undefined. */
export function remoteByNick(snapshot: any, nick: string): any {
  return (snapshot.onlineRemotes || []).find((r: any) => r.nick === nick);
}

/** Poll a player's snapshot until `pred(snapshot)` holds. `pred` runs IN THE
 * PAGE, so it must be self-contained; pass data via `arg`. */
export async function waitForRemote(
  player: OnlinePlayer, pred: string, arg: unknown, timeout = 20_000,
): Promise<void> {
  await player.driver.page.waitForFunction(
    (a) => { const s = JSON.parse((window as any).render_game_to_text()); return new Function('s', 'a', `return (${a.src})(s, a.arg)`)(s, a.arg); },
    { src: pred, arg }, { timeout });
}

export async function closeOnlinePlayers(players: OnlinePlayer[]): Promise<void> {
  for (const p of players) await p.context.close().catch(() => {});
}
