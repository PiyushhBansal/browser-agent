import { chromium, Browser, Page } from "playwright";
/**
 * BrowserController wraps Playwright into the 7 "tools" our agent can use.
 * It holds the browser + page as state so every tool can act on them.
 */

export class BrowserController{
    private browser: Browser | null = null;
    private page: Page | null = null;
    // Counter so every screenshot is saved to a unique numbered file
    // (step-01.png, step-02.png, ...) instead of overwriting one file.
    private screenshotCount: number = 0;

    async openBrowser(): Promise<void>{
        this.browser = await chromium.launch({headless : false});
        this.page = await this.browser.newPage();
    }

    async navigateToUrl(url: string):Promise<void>{
        if(!this.page) throw new Error("Browser not open. Call openBrowser() first.");
        await this.page.goto(url);
    }

    async close(): Promise<void>{
        await this.browser?.close();
    }

    async take_screenshot(path?: string): Promise<Buffer>{
        if(!this.page) throw new Error("Browser not open");
        // Auto-number each screenshot so the full run history is kept:
        // screenshots/step-01.png, step-02.png, ... (unless a path is given).
        this.screenshotCount++;
        const num = String(this.screenshotCount).padStart(2, "0");
        const savePath = path ?? `screenshots/step-${num}.png`;
        const buffer = await this.page.screenshot({path: savePath, fullPage: false});
        return buffer;
    }

    async clickOnScreen(x:number,y:number): Promise<void>{
        if(!this.page) throw new Error("Browser not open");
        await this.page.mouse.click(x,y);
    }

    async sendKeys(text : string):Promise<void>{
        if(!this.page) throw new Error("Browser not open");
        await this.page.keyboard.type(text);
    }

    async scroll(amount:number): Promise<void>{
        if(!this.page) throw new Error("Browser not open");
        await this.page.mouse.wheel(0,amount);
    }

    async doubleClick(x:number, y:number):Promise<void>{
        if(!this.page) throw new Error("Browser not open");
        await this.page.mouse.dblclick(x,y);
    }
    
  async findElement(query: string): Promise<{ x: number; y: number } | null> {
    if (!this.page) throw new Error("Browser not open");

    const candidates = [
      this.page.getByLabel(query, { exact: false }),
      this.page.getByPlaceholder(query, { exact: false }),
      this.page.locator(`[name="${query}"]`),
      this.page.getByText(query, { exact: false }),
    ];

    for (const locator of candidates) {
      const el = locator.first();
      if ((await el.count()) > 0) {
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        if (box) {
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        }
      }
    }
    return null; 
  }

}