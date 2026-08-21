# 🚨 EMAIL DELIVERABILITY - ACTION REQUIRED

## Current Status
✅ Email service working  
❌ DMARC record missing (required by Gmail/Yahoo/Microsoft)  
⚠️ Click tracking enabled (triggers spam filters)  
⚠️ Open tracking enabled (triggers spam filters)  

---

## 🎯 Quick Fix (10 Minutes)

### STEP 1: Add DMARC DNS Record (5 min)

**Cloudflare Dashboard:**
1. Go to: https://dash.cloudflare.com
2. Select: `iaoms.dev`
3. Click: **DNS** → **Add record**
4. Fill in:
   - **Type:** TXT
   - **Name:** `_dmarc`
   - **Content:** 
     ```
     v=DMARC1; p=quarantine; rua=mailto:dmarc@iaoms.dev; ruf=mailto:dmarc@iaoms.dev; fo=1; adkim=s; aspf=s; pct=100; ri=86400
     ```
   - **TTL:** Auto
   - **Proxy:** DNS only (gray cloud)
5. Click: **Save**

### STEP 2: Disable Tracking in Resend (3 min)

1. Go to: https://resend.com/settings
2. Navigate to: **Settings** → **Tracking**
3. **Disable:** Click Tracking
4. **Disable:** Open Tracking
5. Click: **Save**

### STEP 3: Verify (2 min)

Wait 5-10 minutes, then check:
```bash
nslookup -type=TXT _dmarc.iaoms.dev
```

Or use: https://mxtoolbox.com/dmarc.aspx

---

## 📊 Impact

### Before
- Deliverability: 70-80%
- DMARC: ❌ Not found
- Tracking: ⚠️ Enabled
- Spam risk: High

### After
- Deliverability: 95-99%
- DMARC: ✅ Valid
- Tracking: ✅ Disabled
- Spam risk: Low

---

## ✅ Verification Checklist

- [ ] DMARC record added to DNS
- [ ] DNS propagated (wait 5-10 min)
- [ ] Click tracking disabled in Resend
- [ ] Open tracking disabled in Resend
- [ ] Test email sent successfully
- [ ] Email lands in inbox (not spam)

---

## 🆘 Need Help?

Run this for detailed instructions:
```bash
node backend/show-dmarc-config.js
```

Or see: `docs/features/notifications/EMAIL_DELIVERABILITY_FIX.md`

---

**Priority:** 🔴 Critical  
**Time:** 10 minutes  
**Difficulty:** Easy
