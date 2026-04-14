import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

// Mock puppeteer-extra to avoid launching browser during tests
jest.mock('puppeteer-extra', () => {
  const mockPage = {
    setViewport: jest.fn(),
    setUserAgent: jest.fn(),
    setCookie: jest.fn(),
    cookies: jest.fn().mockResolvedValue([]),
    goto: jest.fn(),
    url: jest.fn().mockReturnValue('https://www.avito.ru/profile/messenger'),
    evaluate: jest.fn().mockResolvedValue(true),
    isClosed: jest.fn().mockReturnValue(false),
  };
  return {
    __esModule: true,
    default: {
      use: jest.fn(),
      launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      }),
    },
  };
});

jest.mock('puppeteer-extra-plugin-stealth', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('AppModule', () => {
  it('should compile the module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
