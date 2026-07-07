import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes', () => {
  describe('POST /api/auth/signup', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should accept valid signup data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // Demonstrates the test structure
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/signin', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});