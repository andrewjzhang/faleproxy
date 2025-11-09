const axios = require('axios');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const app = require('../app');

// Use a non-default port for tests
const TEST_PORT = 3099;
let server;

describe('Integration Tests', () => {
  beforeAll(() => {
    // Block all outbound HTTP except localhost/127.0.0.1
    nock.disableNetConnect();
    nock.enableNetConnect(/(localhost|127\.0\.0\.1)/);

    // Start the Express app in this process
    server = app.listen(TEST_PORT);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Mock external HTTP request to example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    // Make a request to our proxy app
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://example.com/'
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    const modifiedHtml = response.data.content;
    const $ = cheerio.load(modifiedHtml);

    // Verify Yale is replaced with Fale in visible text
    expect(modifiedHtml).toContain('Fale University Test Page');
    expect(modifiedHtml).toContain('Welcome to Fale University');

    // Verify URLs still contain yale.edu
    let hasYaleUrl = false;
    $('a').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);

    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  }, 10000);

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url'
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(500);
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  });
});
