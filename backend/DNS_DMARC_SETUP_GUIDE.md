# 🔐 DNS & DMARC Setup Guide for IAOMS Email

## 🚨 Critical Issues from Resend

Your Resend dashboard flagged these issues that need DNS configuration:

1. ❌ **No DMARC record found**
2. ⚠️ **Using "noreply@" email address**
3. ⚠️ **URLs don't match sending domain**
4. ⚠️ **Images hosted on different domain**
5. ⚠️ **SVG images used (not supported by Gmail)**

---

## ✅ FIXES APPLIED

### 1. Email Address Changed
**Before:** `noreply@iaoms.dev`
**After:** `notifications@mail.iaoms.dev`

**Why:** 
- "noreply" decreases trust
- Subdomain segments reputation
- Better deliverability

### 2. Dedicated Email Frontend URL
**Before:** Used `FRONTEND_URL` with multiple values
**After:** New `EMAIL_FRONTEND_URL=https://app.iaoms.dev`

**Why:**
- Consistent URLs in emails
- Matches sending domain
- Avoids spam filters

### 3. Logo Image URL Fixed
**Before:** `${FRONTEND_URL}/iaoms-icon.png` (variable)
**After:** `https://app.iaoms.dev/iaoms-icon.png` (absolute)

**Why:**
- Matches sending domain
- No localhost URLs in production
- Better email client compatibility

### 4. SVG Handling Improved
**Before:** SVGs visible to all clients
**After:** Hidden in Outlook with conditional comments

**Why:**
- Gmail doesn't support SVG
- Outlook shows blank space instead
- Graceful degradation

---

## 🔧 DNS CONFIGURATION REQUIRED

You need to add DNS records to your domain registrar (where you bought `iaoms.dev`).

### Step 1: Add Subdomain for Email

**Record Type:** `CNAME`
**Name:** `mail.iaoms.dev`
**Value:** `iaoms.dev` or your hosting provider

**Purpose:** Creates subdomain for email sending

---

### Step 2: Add DMARC Record (CRITICAL)

**Record Type:** `TXT`
**Name:** `_dmarc.iaoms.dev`
**Value:** 
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@iaoms.dev; ruf=mailto:dmarc-failures@iaoms.dev; fo=1; adkim=r; aspf=r; pct=100; ri=86400
```

**Explanation:**
- `v=DMARC1` - DMARC version
- `p=quarantine` - Quarantine suspicious emails (safer than reject)
- `rua=mailto:...` - Where to send aggregate reports
- `ruf=mailto:...` - Where to send forensic reports
- `fo=1` - Generate reports on any failure
- `adkim=r` - Relaxed DKIM alignment
- `aspf=r` - Relaxed SPF alignment
- `pct=100` - Apply policy to 100% of emails
- `ri=86400` - Report interval (24 hours)

**Simpler Version (for testing):**
```
v=DMARC1; p=none; rua=mailto:dmarc@iaoms.dev
```

---

### Step 3: Verify Resend DNS Records

Go to Resend Dashboard → Domains → iaoms.dev

You should see these records (add them if missing):

#### SPF Record
**Record Type:** `TXT`
**Name:** `@` or `iaoms.dev`
**Value:** 
```
v=spf1 include:_spf.resend.com ~all
```

#### DKIM Records (Resend provides these)
**Record Type:** `TXT`
**Name:** `resend._domainkey.iaoms.dev`
**Value:** (Provided by Resend - copy from dashboard)

---

## 📋 DNS Setup Checklist

### In Your Domain Registrar (e.g., GoDaddy, Namecheap, Cloudflare):

- [ ] Add CNAME for `mail.iaoms.dev`
- [ ] Add TXT record for DMARC (`_dmarc.iaoms.dev`)
- [ ] Verify SPF record exists
- [ ] Verify DKIM records exist (from Resend)
- [ ] Wait 24-48 hours for DNS propagation

### In Resend Dashboard:

- [ ] Verify domain `iaoms.dev`
- [ ] Add subdomain `mail.iaoms.dev` (if needed)
- [ ] Check DNS verification status
- [ ] Test email sending

---

## 🧪 Testing DNS Configuration

### Check DMARC Record:
```bash
nslookup -type=TXT _dmarc.iaoms.dev
```

**Expected Output:**
```
_dmarc.iaoms.dev text = "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@iaoms.dev"
```

### Check SPF Record:
```bash
nslookup -type=TXT iaoms.dev
```

**Expected Output:**
```
iaoms.dev text = "v=spf1 include:_spf.resend.com ~all"
```

### Online Tools:
- **MXToolbox:** https://mxtoolbox.com/dmarc.aspx
- **DMARC Analyzer:** https://www.dmarcanalyzer.com/dmarc/dmarc-record-check/
- **Google Admin Toolbox:** https://toolbox.googleapps.com/apps/checkmx/

---

## 🔄 Update .env File

Your `.env` has been updated with:

```env
# Use subdomain for better deliverability
EMAIL_FROM=notifications@mail.iaoms.dev

# Dedicated URL for email links
EMAIL_FRONTEND_URL=https://app.iaoms.dev
```

**Action Required:**
1. Verify `mail.iaoms.dev` subdomain is configured in DNS
2. Verify `notifications@mail.iaoms.dev` is allowed in Resend
3. Test email sending after DNS propagation

---

## 📊 Expected Resend Dashboard After Fixes

### Before:
- ❌ No DMARC record found
- ⚠️ Using "no-reply"
- ⚠️ Mismatched URLs
- ⚠️ Images on different domain
- ⚠️ SVG images used

### After (once DNS propagates):
- ✅ DMARC record found
- ✅ Using "notifications@"
- ✅ URLs match sending domain
- ✅ Images on sending domain
- ⚠️ SVG images (hidden in unsupported clients)

---

## 🚀 Production Deployment Steps

### 1. DNS Configuration (Do First)
```
1. Log into your domain registrar
2. Add DMARC TXT record
3. Add mail.iaoms.dev CNAME
4. Verify SPF and DKIM records
5. Wait 24-48 hours for propagation
```

### 2. Resend Configuration
```
1. Go to Resend Dashboard
2. Verify iaoms.dev domain
3. Add mail.iaoms.dev subdomain (if needed)
4. Wait for verification
```

### 3. Backend Configuration
```
1. Update .env with new EMAIL_FROM
2. Update .env with EMAIL_FRONTEND_URL
3. Restart backend server
4. Run: npm run test:email-config
```

### 4. Testing
```
1. Run: npm run test:email-templates your-email@example.com
2. Check Resend dashboard for warnings
3. Verify emails arrive in inbox (not spam)
4. Check all links work
```

---

## 🐛 Troubleshooting

### Issue: DMARC record not found
**Solution:** 
- Wait 24-48 hours for DNS propagation
- Use `nslookup -type=TXT _dmarc.iaoms.dev` to verify
- Check record name is exactly `_dmarc.iaoms.dev`

### Issue: Emails going to spam
**Solution:**
- Verify DMARC, SPF, DKIM all pass
- Use subdomain (mail.iaoms.dev)
- Don't use "noreply@"
- Ensure URLs match sending domain

### Issue: Resend says domain not verified
**Solution:**
- Check DNS records in Resend dashboard
- Copy exact values from Resend
- Wait for DNS propagation
- Contact Resend support if stuck

---

## 📞 Support Resources

- **Resend Docs:** https://resend.com/docs
- **DMARC Guide:** https://dmarc.org/overview/
- **DNS Checker:** https://dnschecker.org/
- **Email Tester:** https://www.mail-tester.com/

---

## ✅ Summary

**Immediate Actions:**
1. ✅ Code updated (EMAIL_FROM, EMAIL_FRONTEND_URL)
2. ⏳ Add DMARC DNS record (you need to do this)
3. ⏳ Verify mail.iaoms.dev subdomain (you need to do this)
4. ⏳ Wait for DNS propagation (24-48 hours)
5. ✅ Test emails after propagation

**Expected Timeline:**
- Code changes: ✅ Done
- DNS setup: 30 minutes
- DNS propagation: 24-48 hours
- Testing: 30 minutes

**Total: 2-3 days for full deployment**

---

**🎯 Once DNS is configured, your email deliverability will be excellent!**
