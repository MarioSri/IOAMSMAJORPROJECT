import express from 'express';
import request from 'supertest';
import resendRoutes from '../src/routes/resend';

function createApp() {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      if ((req as express.Request).originalUrl === '/api/resend/webhook') {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      }
    },
  }));
  app.use('/api/resend', resendRoutes);
  return app;
}

describe('Resend webhook security', () => {
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = originalSecret;
  });

  it('fails closed when the webhook secret is missing', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const response = await request(createApp())
      .post('/api/resend/webhook')
      .send({ type: 'email.delivered', data: { email_id: 'evt-1' } });

    expect(response.status).toBe(503);
  });

  it('rejects requests without Svix signature headers', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';

    const response = await request(createApp())
      .post('/api/resend/webhook')
      .send({ type: 'email.delivered', data: { email_id: 'evt-1' } });

    expect(response.status).toBe(400);
  });

  it('rejects invalid signatures', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';

    const response = await request(createApp())
      .post('/api/resend/webhook')
      .set('svix-id', 'msg_test')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,invalid')
      .send({ type: 'email.delivered', data: { email_id: 'evt-1' } });

    expect(response.status).toBe(400);
  });
});
