# Commerce Order Console

A browser-based console for a store operations team that takes orders over the phone.
Staff can **create** orders against live stock, **find** them by reference or status, and
**move them through fulfilment** (Placed → Packed → Shipped, or Cancelled), with the server
guaranteeing that stock never goes wrong.

| Layer    | Tech |
|----------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, react-toastify, lucide-react |
| Backend  | Node.js, Express 5, TypeScript (run with `tsx`), zod validation |
| Database | MongoDB with Mongoose (MongoDB Atlas, or any replica set)  |

---

## 1. Prerequisites

- Node.js 20+ (developed on Node 24)
- MongoDB 6+ running locally (developed on MongoDB 7)

## 2. Setup, seed and run

```bash
# 1) Config
cd Backend
cp .env.example .env          # then edit .env: set your mongodb password in DATABASE_URL
cd ../Frontend
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:4000/api

# 2) Install
npm install
cd ../Backend && npm install


# 4) Run (two terminals)
npm run dev                   # Backend  -> http://localhost:4000/api
cd ../Frontend && npm run dev # Frontend -> http://localhost:5173
```

`Backend/.env`:

```ini
# MongoDB database used by the app. 
DATABASE_URL=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/order_console
PORT=4000
# Frontend origin(s) allowed to call the API, comma-separated
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

`Frontend/.env`:

```ini
# Base URL of the backend API
VITE_API_BASE_URL=http://localhost:4000/api
```
