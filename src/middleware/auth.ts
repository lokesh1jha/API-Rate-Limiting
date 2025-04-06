import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        apiKey: string;
        isActive: boolean;
      };
    }
  }
}

export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }

    const user = await prisma.user.findUnique({
      where: { apiKey: apiKey as string }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'API key is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    // Find user to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if(req.user && req.user !== user) {
      return res.status(401).json({ error: 'User not found' });
    }
    else {
      req.user = user;
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};