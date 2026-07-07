# Backend Quick Reference Card

## 🚀 Start Backend (Choose One)

```bash
# Method 1: Double-click
START_BACKEND.bat

# Method 2: Command line
cd backend && npm run dev

# Method 3: Production
cd backend && npm run build && npm start
```

---

## 🔗 Important URLs

| Service | URL |
|---------|-----|
| Health Check | http://localhost:3001/health |
| API Docs (Swagger) | http://localhost:3001/api-docs |
| WebSocket | ws://localhost:3001 |

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/register
```

### Documents
```
GET    /api/documents
POST   /api/documents
GET    /api/documents/:id
PUT    /api/documents/:id
DELETE /api/documents/:id
```

### Files
```
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
```

---

## 🔑 Environment Variables

Located in: `backend/.env`

**Critical:**
- `JWT_SECRET` ✅ Configured

**Optional:**
- `RESEND_API_KEY` ⚠️ Needs setup for emails

---

## 🧪 Testing

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

---

## 🛠️ Common Commands

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Production mode
npm start

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

---

## 🐛 Troubleshooting

### Port 3001 Already in Use
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Server Connection Issues
- Check `.env` file has correct configuration
- Verify the backend server is running

### Email Not Sending
- Get Resend API key from https://resend.com
- Update `RESEND_API_KEY` in `.env`

---

## 📦 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: localStorage / in-memory storage
- **Real-time**: Socket.IO
- **Email**: Resend API
- **Storage**: Google Drive API
- **Docs**: Swagger UI
- **Testing**: Jest + Supertest

---

## 📞 Quick Help

1. **Server won't start?**
   - Check Node.js version: `node --version` (need 18+)
   - Install dependencies: `npm install`

2. **API not responding?**
   - Check server is running: http://localhost:3001/health
   - Check console for errors

3. **Need API documentation?**
   - Visit: http://localhost:3001/api-docs

---

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] Health check returns OK: http://localhost:3001/health
- [ ] Swagger docs load: http://localhost:3001/api-docs
- [ ] Frontend can connect to backend
- [ ] Tests pass: `npm test`
