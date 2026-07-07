import { Router } from 'express';
import { searchAll } from '../controllers/searchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, searchAll);

export default router;