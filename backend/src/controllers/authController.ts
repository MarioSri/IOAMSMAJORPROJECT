import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

const users = new Map<string, { id: string; email: string; passwordHash: string }>();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function signUp(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      } as ApiResponse);
    }

    if (users.has(email)) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      } as ApiResponse);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `user-${Date.now()}`;
    users.set(email, { id, email, passwordHash });

    return res.status(201).json({
      success: true,
      data: { id, email },
      message: 'User created successfully'
    } as ApiResponse);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
}

export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(401).json({
        success: false,
        error: 'Email and password are required'
      } as ApiResponse);
    }

    const user = users.get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      } as ApiResponse);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      } as ApiResponse);
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    return res.json({
      success: true,
      data: { user: { id: user.id, email: user.email }, session: { access_token: token } }
    } as ApiResponse);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
}