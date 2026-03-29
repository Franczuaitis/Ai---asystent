const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// === BAZA DANYCH (w pliku JSON, prosta i bez instalacji) ===
const fs = require('fs');
const DB_FILE = './data.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { configs: {}, history: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// === API - KONFIGURACJA FIRMY ===

// Zapisz konfigurację
app.post('/api/config', (req, res) => {
  const db = loadDB();
  const id = req.body.id || 'default';
  db.configs[id] = { ...req.body, updatedAt: new Date().toISOString() };
  saveDB(db);
  res.json({ ok: true, id });
});

// Pobierz konfigurację
app.get('/api/config/:id?', (req, res) => {
  const db = loadDB();
  const id = req.params.id || 'default';
  res.json(db.configs[id] || {});
});

// === API - CHAT (panel testowy) ===
app.post('/api/chat', async (req, res) => {
  const { message, configId, history } = req.body;
  const db = loadDB();
  const config = db.configs[configId || 'default'] || {};

  try {
    const reply = await askClaude(message, config, history || []);

    // Zapisz do historii
    db.history.unshift({
      id: Date.now(),
      configId: configId || 'default',
      firmName: config.name || 'Nieznana firma',
      question: message,
      answer: reply,
      channel: 'panel',
      timestamp: new Date().toISOString()
    });
    if (db.history.length > 500) db.history = db.history.slice(0, 500);
    saveDB(db);

    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === API - HISTORIA ===
app.get('/api/history/:configId?', (req, res) => {
  const db = loadDB();
  const configId = req.params.configId || 'default';
  const history = db.history.filter(h => h.configId === configId).slice(0, 100);
  res.json(history);
});

// === FACEBOOK MESSENGER WEBHOOK ===

// Weryfikacja webhooka przez Facebook
app.get('/webhook/facebook', (req, res) => {
  const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'moj_token_weryfikacyjny';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Facebook webhook zweryfikowany!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Odbieranie wiadomości z Facebooka
app.post('/webhook/facebook', async (req, res) => {
  const body = req.body;
  if (body.object !== 'page') return res.sendStatus(404);

  res.sendStatus(200); // Facebook wymaga szybkiej odpowiedzi

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message?.text) continue;

      const senderId = event.sender.id;
      const message = event.message.text;
      const pageId = entry.id;

      console.log(`FB Messenger [${pageId}]: ${message}`);

      // Znajdź konfigurację dla tej strony
      const db = loadDB();
      const config = Object.values(db.configs).find(c => c.fbPageId === pageId)
        || Object.values(db.configs)[0]
        || {};

      try {
        const reply = await askClaude(message, config, []);

        // Wyślij odpowiedź przez Facebook API
        await sendFacebookMessage(senderId, reply, process.env.FB_PAGE_TOKEN);

        // Zapisz do historii
        db.history.unshift({
          id: Date.now(),
          configId: config.id || 'default',
          firmName: config.name || 'Nieznana firma',
          question: message,
          answer: reply,
          channel: 'facebook',
          senderId,
          timestamp: new Date().toISOString()
        });
        saveDB(db);
      } catch (e) {
        console.error('Błąd:', e.message);
      }
    }
  }
});

// === POMOCNICZE FUNKCJE ===

async function askClaude(message, config, history) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Brak klucza ANTHROPIC_API_KEY');

  const tones = {
    przyjazny: 'Jesteś przyjazny i ciepły. Używaj emotikonów z umiarem.',
    profesjonalny: 'Jesteś profesjonalny i rzeczowy. Bez emotikonów.',
    nieformalny: 'Jesteś swobodny i nieformalny.'
  };

  const systemPrompt = `Jesteś asystentem obsługi klienta firmy "${config.name || 'tej firmy'}".

DANE FIRMY:
- Typ: ${config.type || 'firma usługowa'}
- Adres: ${config.address || 'nie podano'}
- Telefon: ${config.phone || 'nie podano'}
- Godziny otwarcia: ${config.hours || 'nie podano'}
- Usługi: ${config.services || 'nie określono'}
- Cennik: ${config.prices || 'zapytaj o wycenę'}
- Rezerwacje: ${config.booking || 'kontakt telefoniczny'}
- Dodatkowe info: ${config.extra || 'brak'}

STYL: ${tones[config.tone] || tones.przyjazny}

ZASADY:
1. Odpowiadaj TYLKO na podstawie podanych informacji o firmie.
2. Jeśli nie znasz odpowiedzi: "Nie mam tej informacji — zadzwoń do nas, chętnie pomożemy!"
3. Odpowiedzi krótkie (max 3-4 zdania).
4. Odpowiadaj po polsku.`;

  const messages = [
    ...history.slice(-10),
    { role: 'user', content: message }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

async function sendFacebookMessage(recipientId, text, pageToken) {
  if (!pageToken) { console.log('Brak FB_PAGE_TOKEN, pomijam wysyłkę'); return; }

  await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });
}

// === START ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI Asystent działa na porcie ${PORT}`));
