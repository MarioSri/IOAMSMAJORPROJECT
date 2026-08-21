const required = ['API_URL', 'TEST_AUTH_TOKEN'];
const providerKeys = ['GROQ_API_KEY_TEXT', 'GEMINI_API_KEY', 'NANONETS_API_KEY', 'GOOGLE_CLOUD_VISION_API_KEY'];

if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
  console.error('Integration tests are opt-in. Set RUN_INTEGRATION_TESTS=true to continue.');
  process.exit(2);
}

const missing = required.filter((name) => !process.env[name]);
if (providerKeys.every((name) => !process.env[name])) {
  missing.push('at least one model provider key (' + providerKeys.join(', ') + ')');
}

if (missing.length > 0) {
  console.error(`Missing integration configuration: ${missing.join(', ')}`);
  process.exit(2);
}

console.log(`Integration preflight passed for ${process.env.API_URL}`);
