export default () => ({
  avito: {
    cookiesPath: process.env.AVITO_COOKIES_PATH || './cookies/avito-cookies.json',
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    targetChatName: process.env.TARGET_CHAT_NAME || 'Рушан',
    pollInterval: parseInt(process.env.POLL_INTERVAL ?? '5000', 10) || 5000,
    userDataDir: process.env.USER_DATA_DIR || './chrome-profile',
  },
});
