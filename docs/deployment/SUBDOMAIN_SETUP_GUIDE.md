# 📧 Subdomain Setup Guide for Better Email Deliverability

## 🎯 Why Use a Subdomain?

### Benefits:
1. **Reputation Segmentation** - Protects your root domain (iaoms.dev) reputation
2. **Clear Purpose** - Shows email providers this is for notifications
3. **Better Deliverability** - Separate reputation tracking
4. **Professional** - Industry best practice
5. **Flexibility** - Can have multiple subdomains for different purposes

### Examples:
- `notifications@mail.iaoms.dev` - System notifications
- `support@mail.iaoms.dev` - Support emails
- `marketing@mail.iaoms.dev` - Marketing campaigns

---

## 🔧 OPTION 1: Use Subdomain (Recommended)

### Step 1: Add Subdomain to Resend

1. Go to: https://resend.com/domains
2. Click "Add Domain"
3. Enter: `mail.iaoms.dev` (not iaoms.dev)
4. Follow verification steps

### Step 2: Add DNS Records

Resend will provide DNS records. Add them to your DNS provider:

**SPF Record:**
```
Type: TXT
Name: mail.iaoms.dev
Value: [Provided by Resend]
```

**DKIM Record:**
```
Type: TXT
Name: [selector]._domainkey.mail.iaoms.dev
Value: [Provided by Resend]
```

**DMARC Record:**
```
Type: TXT
Name: _dmarc.mail.iaoms.dev
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@iaoms.dev
```

### Step 3: Configuration Already Done ✅

Your `.env` is already configured:
```env
EMAIL_FROM=notifications@mail.iaoms.dev
```

### Step 4: Restart Backend

```bash
cd backend
npm start
```

---

## 🔧 OPTION 2: Use Root Domain (Current Working Setup)

If you want to use the root domain immediately without subdomain setup:

### Revert to Root Domain:

Update `.env`:
```env
EMAIL_FROM=notifications@iaoms.dev
```

This works NOW because `iaoms.dev` is already verified.

---

## 📊 Comparison

| Feature | Root Domain | Subdomain |
|---------|-------------|-----------|
| Setup Time | ✅ Already done | ⏳ 5 min + DNS propagation |
| Reputation Protection | ❌ No | ✅ Yes |
| Best Practice | ⚠️ Acceptable | ✅ Recommended |
| Flexibility | ❌ Limited | ✅ High |
| Professional | ✅ Good | ✅ Better |

---

## 🚀 RECOMMENDED APPROACH

### Immediate (Use Root Domain):
```env
EMAIL_FROM=notifications@iaoms.dev
```
- Works immediately
- Good for testing and initial deployment
- Acceptable for production

### Long-term (Use Subdomain):
```env
EMAIL_FROM=notifications@mail.iaoms.dev
```
- Better reputation management
- Industry best practice
- Protects root domain
- More professional

---

## 📋 SUBDOMAIN SETUP CHECKLIST

### If You Choose Subdomain:

- [ ] Go to https://resend.com/domains
- [ ] Click "Add Domain"
- [ ] Enter: `mail.iaoms.dev`
- [ ] Copy DNS records from Resend
- [ ] Add DNS records to your DNS provider
- [ ] Wait for verification (5-30 minutes)
- [ ] Verify in Resend dashboard
- [ ] Keep `EMAIL_FROM=notifications@mail.iaoms.dev` in .env
- [ ] Restart backend server
- [ ] Test with: `npx tsx test-resend-email.ts test@example.com`

### If You Choose Root Domain:

- [ ] Update .env: `EMAIL_FROM=notifications@iaoms.dev`
- [ ] Update emailService.ts default (if needed)
- [ ] Restart backend server
- [ ] Test with: `npx tsx test-resend-email.ts test@example.com`

---

## 🎯 MY RECOMMENDATION

**For Production:** Use subdomain `mail.iaoms.dev`

**Why:**
1. Protects your main domain reputation
2. If notification emails get marked as spam, it won't affect your main domain
3. You can add more subdomains later (support@mail.iaoms.dev, etc.)
4. Shows email providers you're following best practices
5. Better long-term deliverability

**Timeline:**
- Setup: 5 minutes
- DNS Propagation: 5-30 minutes (usually fast)
- Total: ~30 minutes

---

## 🔍 CURRENT STATUS

✅ Root domain `iaoms.dev` - VERIFIED and WORKING  
⏳ Subdomain `mail.iaoms.dev` - NOT YET ADDED  

**Current Configuration:**
```env
EMAIL_FROM=notifications@mail.iaoms.dev  # Subdomain (not verified yet)
```

**Options:**
1. Add subdomain to Resend (5 min) - RECOMMENDED
2. Revert to root domain (instant) - WORKS NOW

---

## 🛠️ QUICK FIX (Use Root Domain Now)

If you want emails working immediately without subdomain setup:

```bash
# Update .env
EMAIL_FROM=notifications@iaoms.dev
```

Then restart backend. Emails will work instantly.

You can add subdomain later when you have time.

---

## 📞 SUPPORT

- **Resend Domains:** https://resend.com/domains
- **Resend Docs:** https://resend.com/docs/dashboard/domains/introduction
- **DNS Checker:** https://dnschecker.org/

---

**Choose your approach and I'll help you implement it!**
