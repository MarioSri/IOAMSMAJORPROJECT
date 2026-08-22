import express from 'express';
import request from 'supertest';
import router from './productionSigning';
import {
  completeSigning,
  createSignedArtifactUrl,
  createSigningIntent,
  markSigningAuthentication,
} from '../services/productionSigningService';

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'signer@example.com',
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    next();
  },
}));

jest.mock('../services/productionSigningService', () => ({
  completeSigning: jest.fn(),
  createSignedArtifactUrl: jest.fn(),
  createSigningIntent: jest.fn(),
  markSigningAuthentication: jest.fn(),
}));

const mockedCreateIntent = jest.mocked(createSigningIntent);
const mockedMarkAuth = jest.mocked(markSigningAuthentication);
const mockedComplete = jest.mocked(completeSigning);
const mockedArtifactUrl = jest.mocked(createSignedArtifactUrl);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/signing', router);
  return app;
}

describe('production signing route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an intent without a document ID', async () => {
    const response = await request(createApp()).post('/api/signing/intents').send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/documentId is required/i);
    expect(mockedCreateIntent).not.toHaveBeenCalled();
  });

  it('rejects an auth proof with missing transaction binding fields', async () => {
    const response = await request(createApp()).post('/api/signing/auth-proof').send({
      documentId: 'document-1',
      requestId: 'request-1',
      authMethod: 'passkey',
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/transactionId.*required/i);
    expect(mockedMarkAuth).not.toHaveBeenCalled();
  });

  it('maps an expired or mismatched proof to 401 without completing signing', async () => {
    mockedMarkAuth.mockRejectedValueOnce(Object.assign(new Error('Authentication proof is invalid or expired'), { status: 401 }));
    const response = await request(createApp()).post('/api/signing/auth-proof').send({
      transactionId: '00000000-0000-0000-0000-000000000002',
      documentId: 'document-1',
      requestId: '00000000-0000-0000-0000-000000000003',
      authMethod: 'passkey',
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/invalid or expired/i);
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it('maps nonparticipant authorization failure to 403', async () => {
    mockedCreateIntent.mockRejectedValueOnce(Object.assign(new Error('You are not authorized to sign this document'), { status: 403 }));
    const response = await request(createApp()).post('/api/signing/intents').send({ documentId: 'document-1' });
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not authorized/i);
  });

  it('maps stale document-version rejection to 409 during completion', async () => {
    mockedComplete.mockRejectedValueOnce(Object.assign(new Error('Document changed after signing started'), { status: 409 }));
    const response = await request(createApp())
      .post('/api/signing/complete')
      .field('documentId', 'document-1')
      .field('transactionId', '00000000-0000-0000-0000-000000000002')
      .field('requestId', '00000000-0000-0000-0000-000000000003')
      .field('signatures', JSON.stringify([{ id: 's1' }]));
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/changed after signing started/i);
  });

  it('maps artifact upload failure to a non-success response', async () => {
    mockedComplete.mockRejectedValueOnce(new Error('Signed artifact upload failed'));
    const response = await request(createApp())
      .post('/api/signing/complete')
      .field('documentId', 'document-1')
      .field('transactionId', '00000000-0000-0000-0000-000000000002')
      .field('requestId', '00000000-0000-0000-0000-000000000003')
      .field('signatures', JSON.stringify([{ id: 's1' }]));
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Signing service unavailable');
  });

  it('rejects an artifact path that the service marks as outside the document', async () => {
    mockedArtifactUrl.mockRejectedValueOnce(Object.assign(new Error('Invalid storage path'), { status: 400 }));
    const response = await request(createApp()).get('/api/signing/files/document-1').query({ path: 'other-document/signed/file.pdf' });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid storage path/i);
  });
});
