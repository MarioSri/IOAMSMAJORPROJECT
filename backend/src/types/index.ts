export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'manager';
  created_at: string;
  updated_at: string;
  notification_preferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone?: string;
  whatsapp_number?: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  user_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
}