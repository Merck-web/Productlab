import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

export interface AvitoMessage {
  id: string;
  text: string;
  author: string;
  time: string;
  isOwn: boolean;
}

@Injectable()
export class AvitoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private previousMessages: AvitoMessage[] = [];
  private chatOpened = false;

  private readonly cookiesPath: string;
  private readonly headless: boolean;
  private readonly targetChatName: string;
  private readonly pollInterval: number;
  private readonly userDataDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.cookiesPath = this.configService.get<string>('avito.cookiesPath')!;
    this.headless = this.configService.get<boolean>('avito.headless')!;
    this.targetChatName = this.configService.get<string>('avito.targetChatName')!;
    this.pollInterval = this.configService.get<number>('avito.pollInterval')!;
    this.userDataDir = this.configService.get<string>('avito.userDataDir')!;
  }

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    this.stopPolling();
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Browser closed');
    }
  }

  private async initialize() {
    try {
      this.logger.log(
        `Starting browser (headless: ${this.headless}, target: "${this.targetChatName}")`,
      );
      this.emitStatus('connecting');

      const userDataDirFull = path.resolve(this.userDataDir);
      if (!fs.existsSync(userDataDirFull)) {
        fs.mkdirSync(userDataDirFull, { recursive: true });
      }

      this.browser = await puppeteer.launch({
        headless: this.headless,
        userDataDir: userDataDirFull,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,800',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      );

      await this.loadCookies();

      this.logger.log('Navigating to Avito messenger...');
      await this.page.goto('https://www.avito.ru/profile/messenger', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      const isAuthed = await this.checkAuth();
      if (!isAuthed) {
        this.logger.warn(
          'Not authenticated. Please log in manually in the browser window.',
        );
        this.emitStatus('auth-required');

        if (this.headless) {
          this.logger.error(
            'Cannot authenticate in headless mode. Set PUPPETEER_HEADLESS=false and restart.',
          );
          this.emitStatus('auth-error');
          return;
        }

        await this.waitForManualAuth();
      }

      await this.saveCookies();
      this.logger.log('Authenticated successfully');
      this.emitStatus('connected');
      this.startPolling();
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      this.emitStatus('error');
    }
  }

  private async loadCookies(): Promise<void> {
    const fullPath = path.resolve(this.cookiesPath);
    if (fs.existsSync(fullPath)) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const cookies = JSON.parse(raw);
        await this.page!.setCookie(...cookies);
        this.logger.log(`Cookies loaded from ${fullPath}`);
      } catch (e) {
        this.logger.warn(`Failed to load cookies: ${e.message}`);
      }
    } else {
      this.logger.log('No cookies file found, will need manual auth');
    }
  }

  private async saveCookies(): Promise<void> {
    const fullPath = path.resolve(this.cookiesPath);
    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const cookies = await this.page!.cookies();
      fs.writeFileSync(fullPath, JSON.stringify(cookies, null, 2));
      this.logger.log(`Cookies saved to ${fullPath}`);
    } catch (e) {
      this.logger.warn(`Failed to save cookies: ${e.message}`);
    }
  }

  private async checkAuth(): Promise<boolean> {
    try {
      const url = this.page!.url();
      if (url.includes('/login') || url.includes('/entrance')) {
        return false;
      }
      const hasMessenger = await this.page!.evaluate(() => {
        return (
          document.querySelector('[data-marker="messenger"]') !== null ||
          document.querySelector('[class*="messenger"]') !== null ||
          window.location.pathname.includes('/messenger')
        );
      });
      return hasMessenger || url.includes('/messenger');
    } catch {
      return false;
    }
  }

  private async waitForManualAuth(): Promise<void> {
    this.logger.log('Waiting for manual authentication (up to 5 minutes)...');
    const timeout = 5 * 60 * 1000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 3000));
      const url = this.page!.url();
      if (url.includes('/messenger')) {
        const isAuthed = await this.checkAuth();
        if (isAuthed) {
          this.logger.log('Manual authentication successful');
          return;
        }
      }
    }
    throw new Error('Authentication timeout — user did not log in within 5 minutes');
  }

  private startPolling(): void {
    this.logger.log(`Starting message polling every ${this.pollInterval}ms`);
    this.pollTimer = setInterval(() => {
      this.pollMessages().catch((e) =>
        this.logger.error(`Poll error: ${e.message}`),
      );
    }, this.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async ensureChatOpen(): Promise<boolean> {
    if (!this.page || this.page.isClosed()) return false;

    const currentUrl = this.page!.url();

    // If we got redirected away from messenger, go back
    if (!currentUrl.includes('/messenger')) {
      this.logger.warn(`Redirected to ${currentUrl}, navigating back to messenger`);
      this.chatOpened = false;
      await this.page!.goto('https://www.avito.ru/profile/messenger', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (this.chatOpened) return true;

    // Debug: dump what elements are on the page to find the right selectors
    const debugInfo = await this.page!.evaluate((targetName: string) => {
      const body = document.body.innerText;
      const hasTarget = body.includes(targetName);

      // Collect all elements whose text includes targetName
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null,
      );
      const matches: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const el = node as HTMLElement;
        // Check direct text content (not children)
        const directText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent?.trim())
          .join('');
        if (directText.includes(targetName)) {
          matches.push(
            `<${el.tagName.toLowerCase()} class="${el.className}" data-marker="${el.getAttribute('data-marker') || ''}">`,
          );
        }
      }

      return { hasTarget, matches: matches.slice(0, 10) };
    }, this.targetChatName);

    this.logger.log(`Debug: target "${this.targetChatName}" in page text: ${debugInfo.hasTarget}`);
    this.logger.log(`Debug: elements with direct text match: ${JSON.stringify(debugInfo.matches)}`);

    // Use Puppeteer's locator to find element by text using XPath
    // Find all elements that directly contain the target name
    const elements = await this.page!.$$eval('*', (els, targetName) => {
      return els
        .filter((el) => {
          const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent?.trim())
            .join('');
          return directText.includes(targetName);
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          className: el.className,
          marker: el.getAttribute('data-marker'),
          parentTag: el.parentElement?.tagName.toLowerCase(),
          parentClass: el.parentElement?.className,
          isLink: el.tagName === 'A' || !!el.closest('a'),
        }));
    }, this.targetChatName);

    this.logger.log(`Debug: found ${elements.length} elements with text "${this.targetChatName}": ${JSON.stringify(elements)}`);

    // Strategy: find the element with the target name, then walk UP to the
    // clickable chat row container and click it
    const clicked = await this.page!.evaluate((targetName: string) => {
      // Find all text nodes containing the target name
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) =>
            node.textContent?.includes(targetName)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        },
      );

      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        const el = textNode.parentElement;
        if (!el) continue;

        // Walk up to find a clickable chat-list item
        // We need the container row, not the <a> link to profile
        let candidate: HTMLElement | null = el;
        for (let i = 0; i < 10 && candidate; i++) {
          // Check if this looks like a chat list item container
          const tag = candidate.tagName.toLowerCase();
          const cls = candidate.className || '';
          const marker = candidate.getAttribute('data-marker') || '';

          // Skip if it's a nav link to profile
          if (tag === 'a' && (candidate.getAttribute('href') || '').includes('/user/')) {
            candidate = candidate.parentElement;
            continue;
          }

          // Look for chat item markers or classes
          if (
            marker.includes('chat') ||
            marker.includes('channel') ||
            cls.includes('chat') ||
            cls.includes('channel') ||
            cls.includes('conversation') ||
            cls.includes('item-')
          ) {
            candidate.click();
            return `clicked: <${tag} class="${cls.substring(0, 60)}" marker="${marker}">`;
          }

          candidate = candidate.parentElement;
        }
      }

      // Fallback: find element with text and simulate a click on its
      // closest non-link ancestor at a reasonable depth
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const directText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent?.trim())
          .join('');

        if (!directText.includes(targetName)) continue;

        // Walk up to find a div/li/section that's not a link
        let parent: HTMLElement | null = el as HTMLElement;
        for (let i = 0; i < 8 && parent; i++) {
          if (
            parent.tagName.toLowerCase() !== 'a' &&
            parent.tagName.toLowerCase() !== 'span' &&
            parent.tagName.toLowerCase() !== 'p' &&
            parent.offsetHeight > 40
          ) {
            parent.click();
            return `fallback-clicked: <${parent.tagName.toLowerCase()} class="${(parent.className || '').substring(0, 60)}">`;
          }
          parent = parent.parentElement;
        }
      }

      return null;
    }, this.targetChatName);

    if (clicked) {
      this.logger.log(`Chat "${this.targetChatName}" opened: ${clicked}`);
      await new Promise((r) => setTimeout(r, 2000));

      // Verify we didn't get redirected to a profile
      const afterUrl = this.page!.url();
      if (afterUrl.includes('/user/') || !afterUrl.includes('/messenger')) {
        this.logger.warn(`Click redirected to profile: ${afterUrl}, going back`);
        await this.page!.goto('https://www.avito.ru/profile/messenger', {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        return false;
      }

      this.chatOpened = true;
      return true;
    }

    this.logger.debug(`Chat "${this.targetChatName}" not found in list`);
    return false;
  }

  private async pollMessages(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;

    try {
      const chatReady = await this.ensureChatOpen();
      if (!chatReady) return;

      // Parse messages from the open chat
      const messages: AvitoMessage[] = await this.page!.evaluate(() => {
        const result: AvitoMessage[] = [];
        const msgElements = document.querySelectorAll(
          '[data-marker="message"], [class*="Message_root"], [class*="message-text"], [class*="ChatMessage"]',
        );

        msgElements.forEach((el, index) => {
          const textEl = el.querySelector(
            '[data-marker="message-text"], [class*="text"], [class*="body"], p',
          );
          const timeEl = el.querySelector(
            '[data-marker="message-time"], [class*="time"], time',
          );
          const text = textEl?.textContent?.trim() || el.textContent?.trim() || '';
          const time = timeEl?.textContent?.trim() || '';
          const isOwn =
            el.classList.toString().includes('own') ||
            el.classList.toString().includes('outgoing') ||
            el.getAttribute('data-own') === 'true';

          if (text) {
            result.push({
              id: `msg-${index}-${text.substring(0, 20)}`,
              text,
              author: isOwn ? 'Вы' : 'Собеседник',
              time,
              isOwn,
            });
          }
        });

        return result;
      });

      const newMessages = messages.filter(
        (msg) => !this.previousMessages.some((prev) => prev.id === msg.id),
      );

      if (newMessages.length > 0) {
        this.logger.log(`Found ${newMessages.length} new message(s)`);
        for (const msg of newMessages) {
          this.eventEmitter.emit('avito.newMessage', msg);
        }
      }

      this.previousMessages = messages;
    } catch (e) {
      this.logger.error(`Error polling messages: ${e.message}`);
    }
  }

  private emitStatus(status: string): void {
    this.eventEmitter.emit('avito.status', { status });
  }
}
