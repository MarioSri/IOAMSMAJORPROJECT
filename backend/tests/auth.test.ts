import express from 'express';
import request from 'supertest';
import authRoutes from '../src/routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes', () => {
  describe('POST /api/auth/signup', () => {
    it('rejects missing credentials', async () => {
      const response = await request(app).post('/api/auth/signup').send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false });
    });

    it('rejects weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('8 characters');
    });
  });

  describe('POST /api/auth/signin', () => {
    it('rejects missing credentials with a generic authentication error', async () => {
      const response = await request(app).post('/api/auth/signin').send({});

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ success: false, error: 'Invalid credentials' });
    });
  });
});
