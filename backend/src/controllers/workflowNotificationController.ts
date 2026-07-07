/**
 * Workflow Notification Controller
 * 
 * REST endpoints for triggering template-based push notifications from workflows.
 * These endpoints are called by frontend components when workflow events occur.
 */

import { Request, Response } from 'express';
import * as NotificationDispatcher from '../services/notificationDispatcher';

// ── Emergency Notifications ──────────────────────────────────────────────────

/**
 * POST /api/workflow-notifications/emergency
 * Body: { title, urgency, description }
 */
export async function notifyEmergency(req: Request, res: Response) {
  try {
    const { title, urgency, description } = req.body;

    if (!title || !urgency || !description) {
      return res.status(400).json({
        success: false,
        error: 'title, urgency, and description are required',
      });
    }

    const result = await NotificationDispatcher.notifyEmergency({
      title,
      urgency,
      description,
    });

    return res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('[NotifyEmergency] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send emergency notification',
    });
  }
}

// ── Approval Workflow Notifications ──────────────────────────────────────────

/**
 * POST /api/workflow-notifications/document-approved
 * Body: { submitterId, docTitle }
 */
export async function notifyDocumentApproved(req: Request, res: Response) {
  try {
    const { submitterId, docTitle } = req.body;

    if (!submitterId || !docTitle) {
      return res.status(400).json({
        success: false,
        error: 'submitterId and docTitle are required',
      });
    }

    const result = await NotificationDispatcher.notifyDocumentApproved({
      submitterId,
      docTitle,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyDocumentApproved] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send approval notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/review-needed
 * Body: { assigneeId, docTitle }
 */
export async function notifyReviewNeeded(req: Request, res: Response) {
  try {
    const { assigneeId, docTitle } = req.body;

    if (!assigneeId || !docTitle) {
      return res.status(400).json({
        success: false,
        error: 'assigneeId and docTitle are required',
      });
    }

    const result = await NotificationDispatcher.notifyReviewNeeded({
      assigneeId,
      docTitle,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyReviewNeeded] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send review notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/document-rejected
 * Body: { submitterId, docTitle }
 */
export async function notifyDocumentRejected(req: Request, res: Response) {
  try {
    const { submitterId, docTitle } = req.body;

    if (!submitterId || !docTitle) {
      return res.status(400).json({
        success: false,
        error: 'submitterId and docTitle are required',
      });
    }

    const result = await NotificationDispatcher.notifyDocumentRejected({
      submitterId,
      docTitle,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyDocumentRejected] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send rejection notification',
    });
  }
}

// ── LiveMeet+ Notifications ───────────────────────────────────────────────────

/**
 * POST /api/workflow-notifications/livemeet-request
 * Body: { recipientIds, requesterName, docTitle, format, urgency }
 */
export async function notifyLiveMeetRequest(req: Request, res: Response) {
  try {
    const { recipientIds, requesterName, docTitle, format, urgency } = req.body;

    if (!recipientIds || !requesterName || !docTitle || !format || !urgency) {
      return res.status(400).json({
        success: false,
        error: 'recipientIds, requesterName, docTitle, format, and urgency are required',
      });
    }

    const result = await NotificationDispatcher.notifyLiveMeetRequest({
      recipientIds,
      requesterName,
      docTitle,
      format,
      urgency,
    });

    return res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('[NotifyLiveMeetRequest] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send LiveMeet+ request notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/livemeet-accepted
 * Body: { requesterId, responderName, docTitle }
 */
export async function notifyLiveMeetAccepted(req: Request, res: Response) {
  try {
    const { requesterId, responderName, docTitle } = req.body;

    if (!requesterId || !responderName || !docTitle) {
      return res.status(400).json({
        success: false,
        error: 'requesterId, responderName, and docTitle are required',
      });
    }

    const result = await NotificationDispatcher.notifyLiveMeetAccepted({
      requesterId,
      responderName,
      docTitle,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyLiveMeetAccepted] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send LiveMeet+ acceptance notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/livemeet-declined
 * Body: { requesterId, responderName }
 */
export async function notifyLiveMeetDeclined(req: Request, res: Response) {
  try {
    const { requesterId, responderName } = req.body;

    if (!requesterId || !responderName) {
      return res.status(400).json({
        success: false,
        error: 'requesterId and responderName are required',
      });
    }

    const result = await NotificationDispatcher.notifyLiveMeetDeclined({
      requesterId,
      responderName,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyLiveMeetDeclined] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send LiveMeet+ decline notification',
    });
  }
}

// ── Chat Notifications ────────────────────────────────────────────────────────

/**
 * POST /api/workflow-notifications/direct-message
 * Body: { recipientId, senderName, message, threadId }
 */
export async function notifyDirectMessage(req: Request, res: Response) {
  try {
    const { recipientId, senderName, message, threadId } = req.body;

    if (!recipientId || !senderName || !message || !threadId) {
      return res.status(400).json({
        success: false,
        error: 'recipientId, senderName, message, and threadId are required',
      });
    }

    const result = await NotificationDispatcher.notifyDirectMessage({
      recipientId,
      senderName,
      message,
      threadId,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyDirectMessage] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send direct message notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/channel-message
 * Body: { recipientIds, senderName, channelHandle, message, excludeSenderId? }
 */
export async function notifyChannelMessage(req: Request, res: Response) {
  try {
    const { recipientIds, senderName, channelHandle, message, excludeSenderId } = req.body;

    if (!recipientIds || !senderName || !channelHandle || !message) {
      return res.status(400).json({
        success: false,
        error: 'recipientIds, senderName, channelHandle, and message are required',
      });
    }

    const result = await NotificationDispatcher.notifyChannelMessage({
      recipientIds,
      senderName,
      channelHandle,
      message,
      excludeSenderId,
    });

    return res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('[NotifyChannelMessage] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send channel message notification',
    });
  }
}

/**
 * POST /api/workflow-notifications/attachment
 * Body: { recipientId, senderName, fileName, threadId }
 */
export async function notifyAttachment(req: Request, res: Response) {
  try {
    const { recipientId, senderName, fileName, threadId } = req.body;

    if (!recipientId || !senderName || !fileName || !threadId) {
      return res.status(400).json({
        success: false,
        error: 'recipientId, senderName, fileName, and threadId are required',
      });
    }

    const result = await NotificationDispatcher.notifyAttachment({
      recipientId,
      senderName,
      fileName,
      threadId,
    });

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[NotifyAttachment] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send attachment notification',
    });
  }
}
