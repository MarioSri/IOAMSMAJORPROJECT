import { Router } from 'express';
import {
  createMeeting,
  listMeetings,
  getMeetingDetail,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  checkConflicts,
  sendNotifications,
} from '../controllers/meetingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/meetings:
 *   post:
 *     summary: Create a new meeting with optional Google Meet/Zoom integration
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateToken, createMeeting);

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: List all meetings
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, listMeetings);

/**
 * @swagger
 * /api/meetings/conflicts:
 *   post:
 *     summary: Check for scheduling conflicts
 *     tags: [Meetings]
 */
router.post('/conflicts', checkConflicts);

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     summary: Get a single meeting by ID
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateToken, getMeetingDetail);

/**
 * @swagger
 * /api/meetings/{id}:
 *   put:
 *     summary: Update a meeting
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticateToken, updateMeeting);

/**
 * @swagger
 * /api/meetings/{id}:
 *   delete:
 *     summary: Delete a meeting
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateToken, deleteMeeting);

/**
 * @swagger
 * /api/meetings/{id}/join:
 *   post:
 *     summary: Join a meeting (returns secure link)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/join', authenticateToken, joinMeeting);

/**
 * @swagger
 * /api/meetings/{id}/notifications:
 *   post:
 *     summary: Send meeting notifications
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/notifications', authenticateToken, sendNotifications);

export default router;
