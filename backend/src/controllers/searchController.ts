import { Request, Response } from 'express';
import { ApiResponse } from '../types';

export async function searchAll(req: Request, res: Response) {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Query parameter required' });
    }

    const q = query.toLowerCase();

    const results: any[] = [];

    // TODO: Implement real search against Supabase
    // Search documents table
    // Search meetings table
    // Search other relevant tables

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Search failed' });
  }
}