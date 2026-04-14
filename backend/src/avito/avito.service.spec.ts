import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AvitoService } from './avito.service';

// Mock puppeteer-extra so it doesn't launch a real browser during tests
jest.mock('puppeteer-extra', () => {
  const mockPage = {
    setViewport: jest.fn(),
    setUserAgent: jest.fn(),
    setCookie: jest.fn(),
    cookies: jest.fn().mockResolvedValue([]),
    goto: jest.fn(),
    url: jest.fn().mockReturnValue('https://www.avito.ru/profile/messenger'),
    evaluate: jest.fn().mockResolvedValue(true),
    $$eval: jest.fn().mockResolvedValue([]),
    isClosed: jest.fn().mockReturnValue(false),
    close: jest.fn(),
  };
  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      use: jest.fn(),
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
  };
});

jest.mock('puppeteer-extra-plugin-stealth', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('AvitoService', () => {
  let service: AvitoService;
  let eventEmitter: EventEmitter2;

  const mockConfigValues: Record<string, any> = {
    'avito.cookiesPath': './cookies/test-cookies.json',
    'avito.headless': true,
    'avito.targetChatName': 'Анжела',
    'avito.pollInterval': 5000,
    'avito.userDataDir': './test-chrome-profile',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvitoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AvitoService>(AvitoService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have correct config values', () => {
    expect((service as any).targetChatName).toBe('Анжела');
    expect((service as any).pollInterval).toBe(5000);
    expect((service as any).headless).toBe(true);
  });

  describe('onModuleDestroy', () => {
    it('should stop polling and close browser', async () => {
      // Simulate that browser was started
      (service as any).browser = { close: jest.fn() };
      (service as any).pollTimer = setInterval(() => {}, 10000);

      await service.onModuleDestroy();

      expect((service as any).browser.close).toHaveBeenCalled();
      expect((service as any).pollTimer).toBeNull();
    });

    it('should handle no browser gracefully', async () => {
      (service as any).browser = null;
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('emitStatus', () => {
    it('should emit status event', () => {
      (service as any).emitStatus('connected');
      expect(eventEmitter.emit).toHaveBeenCalledWith('avito.status', {
        status: 'connected',
      });
    });
  });
});
