import express from 'express';
import request from 'supertest';
import summarizeRoutes from '../src/routes/summarize';

const app = express();
app.use(express.json());
app.use('/api/summarize', summarizeRoutes);

describe('Summarizer route boundary', () => {
  it('rejects requests without a bearer token before invoking external services', async () => {
    const response = await request(app)
      .post('/api/summarize')
      .attach('file', Buffer.from('test document'), 'test.txt');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false });
  });
});
