// backend/src/routes/webauthn/index.ts
import { Router } from 'express';
import { registerOptionsRouter } from './registerOptions';
import { registerVerifyRouter }  from './registerVerify';
import { loginOptionsRouter }    from './loginOptions';
import { loginVerifyRouter }     from './loginVerify';
import { backupVerifyRouter }    from './backupVerify';
import { credentialsRouter }     from './credentials';

export const webauthnRouter = Router();

webauthnRouter.use(registerOptionsRouter);
webauthnRouter.use(registerVerifyRouter);
webauthnRouter.use(loginOptionsRouter);
webauthnRouter.use(loginVerifyRouter);
webauthnRouter.use(backupVerifyRouter);
webauthnRouter.use(credentialsRouter);

// Health check — no auth required, useful for verifying tunnel connectivity
webauthnRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    rpID: process.env.WEBAUTHN_RP_ID ?? 'not-set',
  });
});

export default webauthnRouter;
