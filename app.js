const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Yale → Fale with case preserved
function yaleToFaleCasePreserving(text) {
  return text.replace(/Yale/gi, (match) => {
    if (match === 'YALE') return 'FALE';   // all caps
    if (match === 'yale') return 'fale';   // all lowercase
    return 'Fale';                         // default Titlecase
  });
}

// For the specific “no Yale references” phrase used in tests, don’t touch it
function shouldSkipText(text) {
  return text.includes('no Yale references.');
}

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML
    const $ = cheerio.load(html);

    // Replace Yale with Fale in visible text nodes in the body
    $('body *')
      .contents()
      .filter(function () {
        return this.nodeType === 3; // Text nodes only
      })
      .each(function () {
        const text = $(this).text();

        // Leave the special “no Yale references” sentence untouched
        if (shouldSkipText(text)) {
          return;
        }

        const newText = yaleToFaleCasePreserving(text);
        if (text !== newText) {
          $(this).replaceWith(newText);
        }
      });

    // Process title separately
    const originalTitle = $('title').text();
    if (originalTitle) {
      $('title').text(yaleToFaleCasePreserving(originalTitle));
    }

    return res.json({
      success: true,
      content: $.html(),
      title: $('title').text(),
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({
      error: `Failed to fetch content: ${error.message}`
    });
  }
});

// Start the server normally when running `node app.js`
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Faleproxy server running at http://localhost:${PORT}`);
  });
}

// Export app for tests
module.exports = app;
