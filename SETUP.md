# WA Bot Platform — Setup Guide

## Backend (VPS)

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `JWT_SECRET` — any random long string
- Firebase credentials from your Firebase project → Project Settings → Service Accounts → Generate new private key

### 3. Create admin account
```bash
cd backend
node scripts/createAdmin.js
```

### 4. Start backend
```bash
npm start
# or with auto-restart:
npm run dev
```

Backend runs on port 4000.

---

## Frontend (Vercel)

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Set `VITE_API_URL` to your VPS backend URL, e.g.:
```
VITE_API_URL=https://yourdomain.com:4000/api
```

### 3. Deploy to Vercel
- Push `frontend/` folder to a GitHub repo
- Go to vercel.com → New Project → import that repo
- Add environment variable `VITE_API_URL` in Vercel dashboard
- Deploy

---

## Firebase Setup

1. Go to console.firebase.google.com
2. Create a project (or use existing)
3. Enable **Firestore Database** (production mode)
4. Enable **Realtime Database**
5. Go to Project Settings → Service Accounts → Generate new private key
6. Copy the values into backend `.env`

### Firestore Security Rules (paste in Firebase console)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // backend only via Admin SDK
    }
  }
}
```

---

## VPS Ports
Make sure port `4000` is open in your VPS firewall:
```bash
ufw allow 4000
```

For production, use nginx as reverse proxy + SSL (Let's Encrypt).

---

## Flow Builder Usage

1. Login → Dashboard
2. Click "Connect WhatsApp" → scan QR with your phone
3. Click "+ Create Flow" → give it a name
4. In the builder:
   - Add a **Trigger** node (what message starts the flow)
   - Add **Send Message**, **Options**, **Collect Data** nodes
   - Connect them by dragging from the bottom handle to the top handle of the next node
   - Use **Save Data** node to explicitly save to Firebase
   - End with an **End** node
5. Click **Save Flow** then **Activate**
6. Bot is now live on your WhatsApp number
