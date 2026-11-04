# DukaanSathi

Voice-first business manager for small shops.

## Current features
- Shopkeeper registration and login
- JWT session in an HttpOnly cookie
- Shop-isolated product catalogue
- Add, edit and delete products
- Stock adjustments with stock movement history
- Customer directory and outstanding credit balance
- Record sales using catalogue prices
- Automatically reduce stock and add customer credit
- Record customer payments and reduce outstanding balances
- Transaction history and dashboard stock alerts
- Idempotency key support for sale submission
- Groq-powered voice command interpretation in Hindi, Hinglish and English
- Browser microphone input with editable transcript and typed-command fallback
- Confirmation screen for sales and customer payments
- Voice queries for low-stock products and individual product stock

## Requirements
Use MongoDB Atlas or a MongoDB replica set. Sale and payment workflows use MongoDB multi-document transactions, which are not supported by a standalone local MongoDB server.

## Run backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Configure `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` and `COOKIE_SECURE` in `.env`. Add `GROQ_API_KEY` from the Groq Console and keep it only in the backend `.env`. The default model is `openai/gpt-oss-20b`; change it with `GROQ_MODEL` if needed.

## Run frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## API routes
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`
- GET/POST `/api/products`
- PATCH/DELETE `/api/products/:id`
- POST `/api/products/:id/stock` with `{ "change": 5, "reason": "RESTOCK" }`
- GET/POST `/api/customers`
- PATCH/DELETE `/api/customers/:id`
- GET `/api/dashboard/summary`
- GET `/api/transactions`
- POST `/api/transactions/sales`
- POST `/api/transactions/customers/:customerId/payments`
- POST `/api/voice/interpret` (authenticated; interprets a transcript but never writes business data)

All business routes require the login cookie. Every database query is scoped to the authenticated shop.

## Sale request example
```json
{
  "customerId": "CUSTOMER_OBJECT_ID",
  "items": [
    { "productId": "PRODUCT_OBJECT_ID", "quantity": 2 }
  ],
  "cashReceived": 10,
  "description": "Counter sale"
}
```
The server calculates prices from the product catalogue, checks stock, calculates credit, updates inventory, records stock movements and writes the sale in a MongoDB transaction. If any operation fails, the database transaction is rolled back.

For retry-safe sale submissions, send a unique `Idempotency-Key` header.

## Voice assistant usage
1. Log in and open **Voice assistant** from the sidebar.
2. Choose Hindi/Hinglish or English (India), then use Chrome microphone input or type a command.
3. Review the interpreted action. For a sale, enter or verify the cash received and choose a customer if any amount will remain as credit.
4. Press the explicit confirmation button. Sales and payments are saved through the existing transaction APIs, not by the AI model.

Example commands:
- `Ramesh ko 5 Maggi bechi, 40 rupaye cash mile`
- `Ramesh ne 200 rupaye khate mein diye`
- `Kaunse products ka stock kam hai?`
- `Maggi ka kitna stock bacha hai?`

The browser speech recognition feature depends on browser support and microphone permission. Chrome is recommended; typed commands remain available as a fallback. Groq usage is subject to the rate limits and availability of the user's Groq account. The transcript, shop product names/stock/prices, and customer names needed for matching are sent to Groq; customer balances are fetched by the backend and are not included in the AI prompt. Never put the Groq API key in frontend code.


## Voice assistant: add products and restock by voice (V5)

The voice assistant now supports two additional intents:

- `ADD_PRODUCT`: create a new catalogue product using its name, purchase price, selling price, opening quantity, and optional category/unit/minimum-stock threshold.
- `RESTOCK`: increase the quantity of an existing product.

Example commands (Hindi/Hinglish/English):

- “Naya product Maggi add karo, purchase price 10, selling price 12, quantity 50 packet.”
- “Add a new product, Amul Milk. Purchase price 24, selling price 30, quantity 20 packets.”
- “Amul Milk ka stock 20 packet badha do.”

The AI prepares a draft only. The shopkeeper can edit the fields and must confirm before the existing authenticated product APIs save the product or stock movement. Existing product names are checked to avoid accidental duplicate creation.


## Voice customer creation (V6)

The voice assistant can now create customers after explicit confirmation. Example commands:
- "Naya customer Ramesh Kumar add karo, phone 9876543210"
- "Add a new customer named Priya Sharma"
- "Naya customer Mohan add karo, notes: monthly grocery customer"

The AI extracts the customer name, optional phone number and optional notes. The frontend shows an editable review card; the customer is only saved after the shopkeeper presses **Confirm and add customer**. The backend checks for an existing case-insensitive customer name or matching non-empty phone number to reduce accidental duplicates.


## V7: Customer credit lookup and overall gross profit

### Voice customer-credit lookup
Supported read-only examples:
- "Ramesh ka kitna udhaar baaki hai?"
- "How much credit does Ramesh owe?"
- "Ramesh ka khata balance batao"

The assistant resolves the named customer against the authenticated shop's customer list and reads their current outstanding balance. This command does not create a payment or change the balance.

### Overview gross profit
The Overview page now displays lifetime gross profit from completed sales. It is calculated from sale-time snapshots:
`sum(lineTotal - unitCost * quantity)`

Customer payments are not counted as new profit because they settle previously recorded credit. The displayed figure is gross product profit and does not subtract rent, salaries, utilities, delivery, or other operating expenses. Sales marked as reversed are excluded.


## Deploy to Render (GitHub monorepo)

This repository contains `backend/` and `frontend/`. Deploy them as two Render services from the same GitHub repository.

### Backend Web Service
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `CLIENT_URL` (the deployed frontend URL), `COOKIE_SECURE=true`, `GROQ_API_KEY`, and `GROQ_MODEL=openai/gpt-oss-20b`.

### Frontend Static Site
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Build-time environment variable: `VITE_API_URL` (the deployed backend URL, without a trailing slash).

Add a Static Site rewrite rule for React Router:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

Never commit `.env` files or put `GROQ_API_KEY`, `MONGO_URI`, or `JWT_SECRET` in frontend environment variables. Keep secrets in the backend Render service only.
