# 📧 Email Notification Quick Reference

## 🚀 Quick Commands

```bash
# Validate email configuration
npm run test:email-config

# Send test emails to your inbox
npm run test:email-templates your-email@example.com

# Example
npm run test:email-templates john@gmail.com
```

---

## 📋 6 Notification Types

| Type | Method | Accent Color | Use Case |
|------|--------|--------------|----------|
| **Submission** | `sendDocumentSubmissionNotification()` | Blue #1B3A6B | Document needs approval |
| **Approved** | `sendApprovalResultNotification()` | Green #059669 | Document approved |
| **Rejected** | `sendApprovalResultNotification()` | Red #ef4444 | Document rejected |
| **LiveMeet+ Request** | `sendLiveMeetRequestNotification()` | Purple #7c3aed | Meeting invitation |
| **LiveMeet+ Response** | `sendLiveMeetResponseNotification()` | Green/Red | Meeting accepted/declined |
| **Emergency** | `sendEmergencyNotification()` | Red #dc2626 | Critical alerts |

---

## 💻 Code Examples

### Document Submission
```typescript
await EmailService.sendDocumentSubmissionNotification('user@example.com', {
  docTitle: 'Annual Report 2025',
  submitterName: 'John Doe',
  approvalUrl: `${FRONTEND_URL}/approvals`
});
```

### Document Approved
```typescript
await EmailService.sendApprovalResultNotification('user@example.com', {
  docTitle: 'Annual Report 2025',
  status: 'approved',
  approvalUrl: `${FRONTEND_URL}/documents/123`
});
```

### Document Rejected
```typescript
await EmailService.sendApprovalResultNotification('user@example.com', {
  docTitle: 'Annual Report 2025',
  status: 'rejected',
  reason: 'Missing budget section',
  approvalUrl: `${FRONTEND_URL}/approvals/123/revise`
});
```

### LiveMeet+ Request
```typescript
await EmailService.sendLiveMeetRequestNotification('user@example.com', {
  requesterName: 'Jane Smith',
  documentTitle: 'Annual Report 2025',
  meetUrl: `${FRONTEND_URL}/meetings/456`
});
```

### LiveMeet+ Response
```typescript
// Accepted
await EmailService.sendLiveMeetResponseNotification('user@example.com', {
  submitterName: 'Jane Smith',
  status: 'accepted',
  meetUrl: `${FRONTEND_URL}/meetings/789`
});

// Declined
await EmailService.sendLiveMeetResponseNotification('user@example.com', {
  submitterName: 'Jane Smith',
  status: 'declined'
});
```

### Emergency Alert
```typescript
await EmailService.sendEmergencyNotification('user@example.com', {
  title: 'Power Outage — Building A',
  urgency: 'Critical',
  message: 'Complete power failure detected. Evacuate immediately.'
});
```

---

## 🔧 Environment Variables

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

---

## ✅ Features

- ✅ Professional branded templates
- ✅ Abstract geometric SVG illustrations
- ✅ Outlook Desktop compatible (SVGs hidden gracefully)
- ✅ Gmail clipping prevention (< 100KB)
- ✅ Mobile responsive
- ✅ Data enrichment from Supabase
- ✅ Retry mechanism (3 attempts)
- ✅ Web-safe font fallbacks

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Emails not sending | Run `npm run test:email-config` |
| SVGs broken in Outlook | Expected - they're hidden with `mso-hide:all` |
| Fonts look different | Normal - falls back to system fonts |
| HTML size warning | Reduce SVG complexity if > 100KB |

---

## 📊 Email Client Support

| Client | SVG Support | Status |
|--------|-------------|--------|
| Gmail (Web/Mobile) | ✅ Full | Excellent |
| Apple Mail | ✅ Full | Excellent |
| Outlook 365 (Web) | ✅ Full | Good |
| Outlook Desktop | ❌ Hidden | Graceful fallback |
| Yahoo Mail | ⚠️ Partial | Acceptable |

---

## 🎯 Best Practices

1. **Always use FRONTEND_URL** for links
2. **Test in multiple clients** before production
3. **Check spam folder** during testing
4. **Monitor Resend dashboard** for delivery rates
5. **Keep HTML under 100KB** to avoid Gmail clipping

---

## 📞 Support

- **Resend Dashboard:** https://resend.com/dashboard
- **Email Testing Guide:** See `EMAIL_TESTING_GUIDE.md`
- **Code Location:** `backend/src/services/emailService.ts`

---

**Last Updated:** $(date)
**Status:** ✅ Production Ready
