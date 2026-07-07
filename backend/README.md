# Backend API

A Node.js/Express.js backend with TypeScript and Socket.IO integration.

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + Supabase Auth
- **Real-time**: Supabase Realtime
- **File Storage**: Google Drive API
- **Email**: Resend API
- **Testing**: Jest + Supertest
- **Documentation**: Swagger

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Build**:
   ```bash
   npm run build
   ```

5. **Production**:
   ```bash
   npm start
   ```

## API Documentation

Visit `http://localhost:3001/api-docs` for Swagger documentation.

## Testing

```bash
npm test
npm run test:watch
```

## Environment Variables

See `.env.example` for required environment variables.

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic services
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```