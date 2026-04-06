const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// === SERP API HELPER ===
function serpRequest(params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      ...params,
      api_key: process.env.SERP_API_KEY,
    });
    const url = `https://serpapi.com/search.json?${query}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// === API: Szukaj produktów z prawdziwymi cenami ===
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ results: [] });

  try {
    const data = await serpRequest({
      engine: 'google_shopping',
      q: q,
      gl: 'us',
      hl: 'en',
      num: 20,
    });

    const results = (data.shopping_results || []).map(item => ({
      id: item.position,
      name: item.title,
      store: item.source,
      price: parseFloat(item.price?.replace(/[^0-9.]/g, '')) || 0,
      was: parseFloat(item.extracted_price) || null,
      drop: item.tag ? parseInt(item.tag) : null,
      image: item.thumbnail,
      link: item.link || item.product_link,
      rating: item.rating || null,
      reviews: item.reviews || null,
    })).filter(r => r.price > 0);

    res.json({ results, query: q });
  } catch (err) {
    console.error('SerpApi error:', err.message);
    res.status(500).json({ error: 'Search failed', results: [] });
  }
});

// === API: Hot deals — najlepsze przeceny ===
app.get('/api/deals', async (req, res) => {
  const { cat = 'electronics deals' } = req.query;

  try {
    const data = await serpRequest({
      engine: 'google_shopping',
      q: cat,
      gl: 'us',
      hl: 'en',
      tbs: 'p_ord:rv',
      num: 20,
    });

    const results = (data.shopping_results || []).map(item => ({
      id: item.position,
      name: item.title,
      store: item.source,
      price: parseFloat(item.price?.replace(/[^0-9.]/g, '')) || 0,
      image: item.thumbnail,
      link: item.link || item.product_link,
      rating: item.rating || null,
      tag: item.tag || null,
    })).filter(r => r.price > 0).slice(0, 12);

    res.json({ results });
  } catch (err) {
    console.error('SerpApi deals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals', results: [] });
  }
});

// === API: Porównaj ceny dla konkretnego produktu ===
app.get('/api/compare', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ stores: [] });

  try {
    const data = await serpRequest({
      engine: 'google_shopping',
      q: q,
      gl: 'us',
      hl: 'en',
      num: 10,
    });

    const stores = (data.shopping_results || []).map(item => ({
      name: item.source,
      price: parseFloat(item.price?.replace(/[^0-9.]/g, '')) || 0,
      link: item.link || item.product_link,
      shipping: item.delivery || 'Check store',
      rating: item.rating || null,
      image: item.thumbnail,
    }))
    .filter(r => r.price > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

    if (stores.length > 0) stores[0].best = true;

    res.json({ stores, query: q });
  } catch (err) {
    console.error('SerpApi compare error:', err.message);
    res.status(500).json({ error: 'Compare failed', stores: [] });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, app: 'PriceHunt' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PriceHunt running on port ${PORT}`));
