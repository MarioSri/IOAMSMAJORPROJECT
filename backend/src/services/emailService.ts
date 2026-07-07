import { Resend } from 'resend';
import { supabaseAdmin } from '../config/supabase';

let resend: Resend | null = null;
try {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith('re_') && apiKey !== 're_YourApiKeyHere') {
    resend = new Resend(apiKey);
  } else if (apiKey) {
    console.warn('[Email] Invalid RESEND_API_KEY format — must start with "re_" and not be the placeholder.');
  }
} catch (error) {
  console.error('[Email] Failed to initialize Resend:', error);
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'notifications@iaoms.dev';
const FRONTEND_URL = process.env.EMAIL_FRONTEND_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.iaoms.dev';

// ── Shared design tokens (inline for email-client safety) ────────────────────
const NAVY = '#1B3A6B';
const FONT = `font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;`;

const shell = (accentColor: string, illusSvg: string, bodyContent: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>IAOMS Notification</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;${FONT}">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 40px rgba(27,58,107,0.10);">

        <!-- Accent bar -->
        <tr><td style="background-color:${accentColor};height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Logotype header -->
        <tr><td style="padding:28px 48px 0;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;">
                <span style="font-family:'DM Serif Display', Georgia, serif;font-size:26px;color:${NAVY};letter-spacing:1px;font-weight:bold;">IAOMS</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Illustration Zone -->
        <tr><td style="padding:0;background-color:#f8fafc; overflow:hidden;">
          <!--[if !mso]><!-->
          <div style="mso-hide:all; width:100%; height:200px; display:block;">
            ${illusSvg}
          </div>
          <!--<![endif]-->
          <!--[if mso]>
          <div style="width:100%; height:200px; background-color:#f8fafc;">&nbsp;</div>
          <![endif]-->
        </td></tr>

        <!-- Template-specific body -->
        <tr><td style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${bodyContent}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 48px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.7;${FONT}">
            This is an automated message from IAOMS — The Institutional Activity Oversight &amp; Management System.<br>
            Do not reply to this email.
          </p>
          <p style="margin:0;font-size:12px;${FONT}">
            <a href="${FRONTEND_URL}/settings/notifications" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Manage Notifications</a>
            <a href="${FRONTEND_URL}/privacy" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Privacy Policy</a>
            <a href="${FRONTEND_URL}/help" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Help Center</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Reusable pieces ──────────────────────────────────────────────────────────

const badge = (label: string, bg: string, color: string) =>
  `<tr><td style="padding:28px 48px 0;">
    <span style="display:inline-block;background-color:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:4px 14px;border-radius:50px;${FONT}">${label}</span>
  </td></tr>`;

const greeting = (name: string) =>
  `<tr><td style="padding:6px 48px 0;font-size:14px;color:#64748b;${FONT}">Hello, ${name} —</td></tr>`;

const headline = (text: string, color = '#1a1a2e') =>
  `<tr><td style="padding:8px 48px 0;">
    <h1 style="margin:0;font-family:'DM Serif Display', Georgia, serif;font-size:28px;color:${color};line-height:1.25;letter-spacing:-0.3px;font-weight:bold;">${text}</h1>
  </td></tr>`;

const paragraph = (text: string) =>
  `<tr><td style="padding:12px 48px 0;font-size:14px;color:#4a5568;line-height:1.75;${FONT}">${text}</td></tr>`;

const docCard = (title: string, subtitle: string, accentColor: string) =>
  `<tr><td style="padding:16px 48px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#f4f7fd;border:1px solid #dce8fb;border-radius:10px;">
      <tr>
        <td width="56" style="padding:14px 0 14px 16px;vertical-align:middle;">
          <div style="width:40px;height:40px;background-color:${accentColor};border-radius:8px;text-align:center;line-height:40px;">
            <span style="color:#ffffff;font-size:18px;">&#128196;</span>
          </div>
        </td>
        <td style="padding:14px 16px;vertical-align:middle;">
          <p style="margin:0 0 3px;font-size:12px;color:#64748b;${FONT}">${subtitle}</p>
          <strong style="font-size:14px;color:#1a1a2e;${FONT}">${title}</strong>
        </td>
      </tr>
    </table>
  </td></tr>`;

const ctaButton = (label: string, url: string, bg: string, color = '#ffffff') =>
  `<tr><td style="padding:24px 48px 0;">
    <a href="${url}" style="display:inline-block;background-color:${bg};color:${color};font-family:'DM Sans', Arial, sans-serif;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">${label}</a>
  </td></tr>`;

const divider = () =>
  `<tr><td style="padding:24px 48px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>`;

const fine = (text: string) =>
  `<tr><td style="padding:16px 48px 28px;font-size:12px;color:#94a3b8;line-height:1.7;${FONT}">${text}</td></tr>`;

// ── SVGs ───────────────────────────────────────────────────────────────────

const SVGS = {
  submission: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <circle cx="500" cy="30"  r="90" fill="#dce8fb" opacity="0.45"/>
      <circle cx="80"  cy="185" r="65" fill="#dce8fb" opacity="0.3"/>
      <rect x="213" y="50" width="154" height="118" rx="8" fill="#b8cce8" opacity="0.5"/>
      <rect x="221" y="42" width="154" height="118" rx="8" fill="#cad8f0" opacity="0.7"/>
      <rect x="229" y="34" width="154" height="118" rx="8" fill="#ffffff" stroke="#dce8fb" stroke-width="1.5"/>
      <rect x="248" y="56" width="64" height="9" rx="3" fill="#1B3A6B" opacity="0.85"/>
      <rect x="248" y="72" width="116" height="5" rx="2" fill="#c7d2e7"/>
      <rect x="248" y="83" width="98"  height="5" rx="2" fill="#c7d2e7"/>
      <rect x="248" y="94" width="108" height="5" rx="2" fill="#c7d2e7"/>
      <rect x="248" y="108" width="72" height="5" rx="2" fill="#c7d2e7"/>
      <circle cx="348" cy="126" r="20" fill="none" stroke="#1B3A6B" stroke-width="2" stroke-dasharray="4 2" opacity="0.45"/>
      <circle cx="448" cy="90" r="32" fill="#1B3A6B" opacity="0.07"/>
      <path d="M448 108 L448 70"  stroke="#1B3A6B" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M436 82 L448 70 L460 82" stroke="#1B3A6B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="158" cy="54"  r="5" fill="#93b4e8" opacity="0.55"/>
      <circle cx="492" cy="158" r="7" fill="#93b4e8" opacity="0.4"/>
      <circle cx="170" cy="142" r="3" fill="#1B3A6B" opacity="0.2"/>
    </svg>`,
  approved: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <circle cx="290" cy="100" r="90" fill="#d1fae5" opacity="0.4"/>
      <circle cx="290" cy="100" r="68" fill="#a7f3d0" opacity="0.35"/>
      <circle cx="290" cy="100" r="48" fill="#6ee7b7" opacity="0.28"/>
      <circle cx="290" cy="100" r="32" fill="#059669"/>
      <path d="M276 100 l10 10 l20-20" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="138" cy="100" r="16" fill="#059669"/>
      <path d="M131 100 l5 6 l10-11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="154" y="99" width="48" height="2" rx="1" fill="#a7f3d0"/>
      <circle cx="442" cy="100" r="16" fill="#059669"/>
      <path d="M435 100 l5 6 l10-11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="378" y="99" width="48" height="2" rx="1" fill="#a7f3d0"/>
      <circle cx="90"  cy="50"  r="6" fill="#6ee7b7" opacity="0.6"/>
      <circle cx="492" cy="162" r="8" fill="#6ee7b7" opacity="0.45"/>
    </svg>`,
  rejected: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <circle cx="290" cy="100" r="84" fill="#fee2e2" opacity="0.5"/>
      <circle cx="290" cy="100" r="60" fill="#fca5a5" opacity="0.2"/>
      <rect x="168" y="38" width="58" height="76" rx="5" fill="#ffffff" stroke="#fca5a5" stroke-width="1.5" transform="rotate(-16 197 76)"/>
      <rect x="362" y="44" width="58" height="76" rx="5" fill="#ffffff" stroke="#fca5a5" stroke-width="1.5" transform="rotate(14 391 82)"/>
      <circle cx="290" cy="100" r="34" fill="#ef4444"/>
      <path d="M276 86 L304 114 M304 86 L276 114" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <path d="M158 100 Q200 82 228 100" stroke="#fca5a5" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/>
      <path d="M352 100 Q380 82 422 100" stroke="#fca5a5" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/>
    </svg>`,
  livemeet: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <circle cx="290" cy="96" r="78" fill="#dcfce7" opacity="0.55"/>
      <circle cx="290" cy="96" r="54" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.3"/>
      <circle cx="290" cy="96" r="40" fill="#22c55e"/>
      <circle cx="290" cy="96" r="17" fill="#dc2626"/>
      <line x1="246" y1="96" x2="178" y2="96" stroke="#bbf7d0" stroke-width="1.5" stroke-dasharray="4 3"/>
      <line x1="334" y1="96" x2="402" y2="96" stroke="#bbf7d0" stroke-width="1.5" stroke-dasharray="4 3"/>
      <rect x="86"  y="81" width="90" height="30" rx="15" fill="#ffffff" stroke="#bbf7d0" stroke-width="1.5"/>
      <rect x="404" y="81" width="90" height="30" rx="15" fill="#ffffff" stroke="#bbf7d0" stroke-width="1.5"/>
      <circle cx="98"  cy="42"  r="5" fill="#86efac" opacity="0.6"/>
      <circle cx="482" cy="158" r="6" fill="#86efac" opacity="0.5"/>
    </svg>`,
  emergency: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <circle cx="290" cy="108" r="85" fill="none" stroke="#fca5a5" stroke-width="1.5" opacity="0.5"/>
      <circle cx="290" cy="108" r="64" fill="none" stroke="#fca5a5" stroke-width="1.5" opacity="0.6"/>
      <circle cx="290" cy="108" r="43" fill="#fee2e2" opacity="0.65"/>
      <polygon points="290,40 364,160 216,160" fill="#dc2626"/>
      <polygon points="290,44 360,156 220,156" fill="#ef4444"/>
      <rect x="285.5" y="68" width="9" height="46" rx="4.5" fill="#ffffff"/>
      <circle cx="290" cy="136" r="5.5" fill="#ffffff"/>
      <line x1="198" y1="54"  x2="184" y2="42"  stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="382" y1="54"  x2="396" y2="42"  stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  routing: `
    <svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <rect x="88"  y="97" width="404" height="6" rx="3" fill="#fde68a"/>
      <rect x="88"  y="97" width="224" height="6" rx="3" fill="#f59e0b"/>
      <circle cx="130" cy="100" r="22" fill="#059669"/>
      <path d="M120 100 l7 7 l13-13" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="254" cy="100" r="22" fill="#059669"/>
      <circle cx="376" cy="100" r="36" fill="#fde68a" opacity="0.45"/>
      <circle cx="376" cy="100" r="22" fill="#f59e0b"/>
      <circle cx="462" cy="100" r="22" fill="#e2e8f0"/>
      <circle cx="78"  cy="48"  r="6" fill="#fcd34d" opacity="0.5"/>
    </svg>`
};

// ── EmailService ─────────────────────────────────────────────────────────────

export class EmailService {

  static async sendNotification(
    to: string,
    subject: string,
    html: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      if (!resend) {
        console.warn('[Email] RESEND_API_KEY not configured — skipping email to:', to);
        return { success: false, error: 'Email service not configured' };
      }

      // Validate HTML size (Gmail clips at 102KB)
      const htmlSize = Buffer.byteLength(html, 'utf8');
      if (htmlSize > 100000) {
        console.warn(`[Email] HTML size ${htmlSize} bytes exceeds recommended 100KB limit (Gmail may clip)`);
      }

      const { data, error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) { console.error('[Email] Send failed:', error); return { success: false, error }; }
      return { success: true };
    } catch (error) {
      console.error('[Email] Unexpected error:', error);
      return { success: false, error };
    }
  }

  // ── 1. Document Submission ────────────────────────────────────────────────

  static async sendDocumentSubmissionNotification(
    to: string,
    params: { docTitle: string; submitterName: string; approvalUrl: string }
  ) {
    const body = [
      badge('Action Required', '#dce8fb', NAVY),
      greeting('Approver'),
      headline('A document is awaiting your approval'),
      paragraph(`<strong>${params.submitterName}</strong> has submitted a new document through the IAOMS workflow that requires your review and decision.`),
      docCard(params.docTitle, 'Pending Approval', NAVY),
      ctaButton('Open in Approval Center', params.approvalUrl, NAVY),
      divider(),
      fine('This request was routed to you as part of the approval chain. If you have questions, contact the document owner directly in IAOMS.'),
    ].join('');

    return this.sendNotification(to, `Action Required: ${params.docTitle}`, shell(NAVY, SVGS.submission, body));
  }

  // ── 2. Approval Results ──────────────────────────────────────────────────

  static async sendApprovalResultNotification(
    to: string,
    params: { docTitle: string; status: 'approved' | 'rejected'; reason?: string; approvalUrl: string }
  ) {
    const approved = params.status === 'approved';

    const reasonBlock = (!approved && params.reason)
      ? `<tr><td style="padding:16px 48px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background-color:#fff5f5;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#991b1b;${FONT}">Reviewer's Feedback</p>
              <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.65;${FONT}">${params.reason}</p>
            </td></tr>
          </table>
        </td></tr>`
      : '';

    const body = [
      badge(approved ? 'Approved' : 'Document Returned', approved ? '#d1fae5' : '#fee2e2', approved ? '#065f46' : '#991b1b'),
      greeting('Submitter'),
      headline(approved ? 'Your document has been approved' : 'Your document needs revision', approved ? '#1a1a2e' : '#dc2626'),
      paragraph(approved
        ? `Great news! <strong>${params.docTitle}</strong> has completed the full approval chain and is now officially approved.`
        : `Your submission <strong>${params.docTitle}</strong> was reviewed and returned with feedback. Please address the comments below and resubmit.`),
      docCard(params.docTitle, approved ? 'All stages cleared' : 'Returned for revision', approved ? '#059669' : '#ef4444'),
      reasonBlock,
      ctaButton(approved ? 'View Approved Document' : 'Revise & Resubmit', params.approvalUrl, approved ? '#059669' : '#ef4444'),
      divider(),
      fine(approved
        ? 'The signed copy is now accessible in your IAOMS document library. A Google Drive backup has been created automatically.'
        : 'Once you\'ve made the necessary changes, open the document in IAOMS and use the "Resubmit" option to restart the approval flow.'),
    ].join('');

    return this.sendNotification(
      to,
      `Document ${approved ? 'Approved' : 'Rejected'}: ${params.docTitle}`,
      shell(approved ? '#059669' : '#ef4444', approved ? SVGS.approved : SVGS.rejected, body)
    );
  }

  // ── 3. LiveMeet+ Request ─────────────────────────────────────────────────

  static async sendLiveMeetRequestNotification(
    to: string,
    params: { requesterName: string; documentTitle: string; meetUrl: string }
  ) {
    const body = [
      badge('LiveMeet+ Invitation', '#ede9fe', '#5b21b6'),
      greeting('Participant'),
      headline("You've been invited to a live meeting"),
      paragraph(`<strong>${params.requesterName}</strong> would like to schedule a LiveMeet+ session with you to discuss the following document:`),
      docCard(params.documentTitle, 'Regarding document', '#7c3aed'),
      ctaButton('Accept & Open Meeting', params.meetUrl, '#7c3aed'),
      divider(),
      fine('You can also decline this request from your IAOMS Notifications panel. Meeting rooms are automatically provisioned when accepted.'),
    ].join('');

    return this.sendNotification(
      to,
      `LiveMeet+ Request from ${params.requesterName}`,
      shell('#7c3aed', SVGS.livemeet, body)
    );
  }

  // ── 4. LiveMeet+ Response ────────────────────────────────────────────────

  static async sendLiveMeetResponseNotification(
    to: string,
    params: { submitterName: string; status: 'accepted' | 'declined'; meetUrl?: string }
  ) {
    const accepted = params.status === 'accepted';
    const body = [
      badge(accepted ? 'Meeting Accepted' : 'Meeting Declined', accepted ? '#d1fae5' : '#fee2e2', accepted ? '#065f46' : '#991b1b'),
      greeting('Requester'),
      headline(accepted ? 'Your LiveMeet+ was accepted' : 'Your LiveMeet+ was declined', accepted ? '#1a1a2e' : '#dc2626'),
      paragraph(`<strong>${params.submitterName}</strong> has <strong>${params.status}</strong> your LiveMeet+ request.`),
      accepted && params.meetUrl ? ctaButton('Open Meeting Room', params.meetUrl, '#059669') : '',
      divider(),
      fine(accepted
        ? 'Your meeting room is ready. Join at the scheduled time using the link above.'
        : 'You can submit a new LiveMeet+ request or reach out through IAOMS messaging.'),
    ].join('');

    return this.sendNotification(
      to,
      `LiveMeet+ ${accepted ? 'Accepted' : 'Declined'} by ${params.submitterName}`,
      shell(accepted ? '#059669' : '#ef4444', SVGS.livemeet, body)
    );
  }

  // ── 5. Emergency Notification ────────────────────────────────────────────

  static async sendEmergencyNotification(
    to: string,
    params: { title: string; urgency: string; message: string }
  ) {
    const urgencyColor = params.urgency.toLowerCase() === 'critical' ? '#7f1d1d' : '#991b1b';
    const urgencyBg    = params.urgency.toLowerCase() === 'critical' ? '#fee2e2' : '#fef2f2';

    const body = [
      badge('Emergency Alert', '#fee2e2', '#991b1b'),
      `<tr><td style="padding:8px 48px 0;font-size:14px;color:#64748b;${FONT}">Attention, All Staff —</td></tr>`,
      headline('Critical institution-wide alert', '#dc2626'),
      `<tr><td style="padding:16px 48px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background-color:${urgencyBg};border:2px solid #dc2626;border-radius:10px;">
          <tr><td style="padding:18px 20px;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <strong style="font-size:16px;color:#dc2626;${FONT}">${params.title}</strong>
                </td>
                <td style="vertical-align:middle;">
                  <span style="display:inline-block;background-color:${urgencyColor};color:#fef2f2;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:3px 10px;border-radius:50px;${FONT}">${params.urgency.toUpperCase()}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.65;${FONT}">${params.message}</p>
          </td></tr>
        </table>
      </td></tr>`,
      ctaButton('View Emergency Dashboard', `${FRONTEND_URL}/emergency`, '#dc2626'),
      divider(),
      fine('This is a high-priority automated alert from IAOMS Emergency Management. Do not ignore this notification. Contact your floor warden immediately.'),
    ].join('');

    return this.sendNotification(to, `🚨 EMERGENCY: ${params.title}`, shell('#dc2626', SVGS.emergency, body));
  }

  // ── 6. Workflow Routing ──────────────────────────────────────────────────

  static async sendRoutingNotification(
    to: string,
    params: { docTitle: string; routingType: string; action: string }
  ) {
    const body = [
      badge('Your Turn to Review', '#ffedd5', '#9a3412'),
      greeting('Next Approver'),
      headline('A document has reached your approval stage'),
      paragraph(`The approval chain has progressed and is now at the <strong>${params.routingType}</strong> stage — assigned to you.`),
      docCard(params.docTitle, params.action, '#f59e0b'),
      ctaButton('Open in Approval Center', `${FRONTEND_URL}/approvals`, '#f59e0b', '#78350f'),
      divider(),
      fine('The workflow will automatically advance once you complete this stage. You may also request a LiveMeet+ with the submitter from within the Approval Center.'),
    ].join('');

    return this.sendNotification(to, `Workflow Update: ${params.docTitle}`, shell('#f59e0b', SVGS.routing, body));
  }

  // ── Legacy compat ────────────────────────────────────────────────────────

  static async sendDocumentApprovalRequest(to: string, documentTitle: string, approverName: string) {
    return this.sendDocumentSubmissionNotification(to, {
      docTitle: documentTitle,
      submitterName: approverName,
      approvalUrl: `${FRONTEND_URL}/approvals`,
    });
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  static async resendEmail(notificationId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { data: notification, error: fetchError } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) return { success: false, error: 'Notification not found' };

      const meta = (notification.metadata as Record<string, any>) || {};
      const to = meta.email_to as string;
      const type = meta.email_type as string;
      const params = meta.email_params as Record<string, any>;

      if (!to || !type || !params) return { success: false, error: 'Insufficient metadata to resend' };

      let result: { success: boolean; error?: any };
      switch (type) {
        case 'submission':       result = await this.sendDocumentSubmissionNotification(to, params as any); break;
        case 'approval':         result = await this.sendApprovalResultNotification(to, params as any); break;
        case 'livemeet_request': result = await this.sendLiveMeetRequestNotification(to, params as any); break;
        case 'livemeet_response':result = await this.sendLiveMeetResponseNotification(to, params as any); break;
        case 'emergency':        result = await this.sendEmergencyNotification(to, params as any); break;
        case 'routing':          result = await this.sendRoutingNotification(to, params as any); break;
        default:                 result = { success: false, error: `Unknown email type: ${type}` };
      }

      const currentCount = (notification.email_retry_count as number) || 0;
      await supabaseAdmin.from('notifications').update({
        email_sent: result.success,
        email_failed: !result.success,
        email_retry_count: currentCount + 1,
        last_email_attempt_at: new Date().toISOString(),
      }).eq('id', notificationId);

      return result;
    } catch (err) {
      console.error('[Email] resendEmail error:', err);
      return { success: false, error: err };
    }
  }
}
