# AI Asystent Obsługi Klienta

Asystent AI dla małych firm — odpowiada na pytania klientów 24/7.

## Uruchomienie lokalne

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Otwórz: http://localhost:3000

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| ANTHROPIC_API_KEY | Klucz API Claude (wymagany) |
| FB_VERIFY_TOKEN | Token weryfikacyjny Facebook Webhook |
| FB_PAGE_TOKEN | Token strony Facebook (do wysyłania odpowiedzi) |
| PORT | Port serwera (domyślnie 3000) |

## Wdrożenie na Render.com

1. Wgraj repo na GitHub
2. Nowy Web Service na render.com
3. Build: `npm install`, Start: `node server.js`
4. Dodaj zmienne środowiskowe
5. Deploy!

## Endpointy

- `GET /` — Panel konfiguracyjny
- `POST /api/config` — Zapisz konfigurację firmy
- `GET /api/config/:id` — Pobierz konfigurację
- `POST /api/chat` — Wyślij wiadomość do asystenta
- `GET /api/history/:id` — Historia rozmów
- `GET/POST /webhook/facebook` — Webhook Facebook Messenger
