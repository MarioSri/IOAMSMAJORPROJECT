require('dotenv').config();

console.log('VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY ? 'SET ✅' : 'MISSING ❌');
console.log('Value:', process.env.VAPID_PUBLIC_KEY);
