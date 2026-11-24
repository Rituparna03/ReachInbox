import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/** Same-origin via the Vercel proxy => 'lax' is correct and survives third-party-cookie blocking. */
export const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: config.isProd, path: '/' };

export interface AuthedRequest extends Request { userId?: string }

export const signToken = (userId: string, expiresIn: string | number = '7d') =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: expiresIn as any });

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const t = req.cookies?.token as string | undefined;
    if (!t) throw new Error('no token');
    req.userId = (jwt.verify(t, config.jwtSecret) as { sub: string }).sub;
    next();
  } catch { res.status(401).json({ error: 'Not authenticated' }); }
}
