import { generateKeyPairSync, createSign, createHash } from 'crypto';
import https from 'https';

function rekorPost(eventHash, sig, pubKeyB64, label) {
  return new Promise(resolve => {
    const entry = { apiVersion: '0.0.1', kind: 'hashedrekord',
      spec: { data: { hash: { algorithm: 'sha256', value: eventHash } },
              signature: { content: sig.toString('base64'), publicKey: { content: pubKeyB64 } } } };
    const body = JSON.stringify(entry);
    const req = https.request({
      hostname: 'rekor.sigstore.dev', path: '/api/v1/log/entries', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 201) {
          const uuid = Object.keys(JSON.parse(data))[0];
          console.log(`  [${label}] ✅ ACCEPTED — uuid=${uuid.slice(0,20)}...`);
        } else {
          let msg = data; try { msg = JSON.parse(data).message; } catch {}
          console.log(`  [${label}] ❌ HTTP ${res.statusCode} — ${msg.slice(0,80)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`  [${label}] ❌ Error: ${e.message}`); resolve(); });
    req.write(body); req.end();
  });
}

const { privateKey: ecKey, publicKey: ecPub } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const { privateKey: rsaKey, publicKey: rsaPub } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const tag = Date.now();
const artifactBytes = Buffer.from(`test-artifact-${tag}`, 'utf8');
const artifactHash  = createHash('sha256').update(artifactBytes).digest('hex');
const hashBytes     = Buffer.from(artifactHash, 'hex');
const ecPubB64      = Buffer.from(ecPub).toString('base64');
const rsaPubB64     = Buffer.from(rsaPub).toString('base64');

console.log('Testing 6 Rekor signing variations against rekor.sigstore.dev...\n');
await rekorPost(artifactHash, createSign('SHA256').update(artifactBytes).sign(ecKey),  ecPubB64,  'EC-sign-artifact');
await rekorPost(artifactHash, createSign('SHA256').update(hashBytes).sign(ecKey),      ecPubB64,  'EC-sign-hashBytes');
await rekorPost(artifactHash, createSign('SHA256').update(artifactHash).sign(ecKey),   ecPubB64,  'EC-sign-hashHexStr');
await rekorPost(artifactHash, createSign('SHA256').update(artifactBytes).sign(rsaKey), rsaPubB64, 'RSA-sign-artifact');
await rekorPost(artifactHash, createSign('SHA256').update(hashBytes).sign(rsaKey),     rsaPubB64, 'RSA-sign-hashBytes');
await rekorPost(artifactHash, createSign('SHA256').update(artifactHash).sign(rsaKey),  rsaPubB64, 'RSA-sign-hashHexStr');
console.log('\nDone.');
