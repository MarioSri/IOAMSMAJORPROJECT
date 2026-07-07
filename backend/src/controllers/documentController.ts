import { Request, Response } from 'express';
import { ApiResponse } from '../types';

const documentsStore: any[] = [];

export async function createDocument(req: Request, res: Response) {
  try {
    const { title, content } = req.body;
    const user = (req as any).user;

    const newDoc = {
      id: `doc-${Date.now()}`,
      title,
      content,
      user_id: user?.id || 'anonymous',
      status: 'draft',
      created_at: new Date().toISOString()
    };

    documentsStore.push(newDoc);

    return res.status(201).json({ success: true, data: newDoc } as ApiResponse);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create document' } as ApiResponse);
  }
}

export async function getDocuments(req: Request, res: Response) {
  try {
    const data = [...documentsStore].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch documents' } as ApiResponse);
  }
}