import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { firstOpenFixture } from './customLineupFirstOpenBrowserFixture';

// Opt-in external Playwright/Chromium; the fixture binds only to local loopback.
const modulePath = process.env.CUSTOM_FIRST_OPEN_PLAYWRIGHT_MODULE;
const executablePath = process.env.CUSTOM_FIRST_OPEN_CHROMIUM_EXECUTABLE;
describe.skipIf(!modulePath)('mounted Custom first-open cookies over real local HTTP', () => {
  async function start(unsafe = false) {
    const { chromium } = await import(/* @vite-ignore */ modulePath!);
    const browser = await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const context = await browser.newContext({viewport:{width:390,height:844}});
    if (unsafe) await context.addInitScript(() => {
      // Negative control reproduces the old transport; no product escape hatch.
      Object.defineProperty(navigator,'locks',{value:{request:(_name:string,_options:unknown,run:()=>unknown)=>run()}});
    });
    context.setDefaultTimeout(5000); context.on('page',(page: any)=>page.on('pageerror',(e: Error)=>console.error(e.message)));
    const fixture = await firstOpenFixture();
    return {...fixture,context,async stop(){await context.close();await browser.close();await fixture.close();}};
  }
  async function hint(page: any) {
    await page.getByRole('button',{name:'Reveal clue'}).click();
    await page.getByText('TEST_DECADE',{exact:true}).waitFor();
  }
  async function wrongGuess(page: any) {
    await page.getByLabel('Guess the player').fill('Wrong');
    await page.getByRole('button',{name:'Wrong Player',exact:true}).click();
    await page.getByRole('button',{name:'Guess player'}).click();
    await page.getByText('1 / 3 strikes',{exact:true}).waitFor();
  }
  it('negative control: last Set-Cookie hides earned progress after two first opens', async()=>{
    const f = await start(true);
    try {
      const a=await f.context.newPage(), b=await f.context.newPage();
      await a.goto(f.origin); await f.received.promise;
      await b.goto(f.origin); await hint(b); await wrongGuess(b);
      const before = await f.context.cookies();
      expect(f.rows.size).toBe(2);
      expect([...f.rows.values()].map(r=>r.revision).sort()).toEqual([0,2]);
      f.held.resolve(); await f.sent.promise;
      await a.getByRole('button',{name:'Reveal clue'}).waitFor();
      expect((await f.context.cookies())[0].value).not.toBe(before[0].value);
      await b.reload();
      await b.getByText('0 / 3 strikes',{exact:true}).waitFor();
      expect(await b.getByText('TEST_DECADE',{exact:true}).count()).toBe(0);
      expect([...f.rows.values()].map(r=>r.revision).sort()).toEqual([0,2]);
    } finally { await f.stop(); }
  },30000);
});
