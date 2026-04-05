import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET || 'secretKey';
    if (jwtSecret === 'secretKey') {
      // Only warn in dev, don't block
      console.warn('[WARN] JWT_SECRET is using default value. Set JWT_SECRET env variable in production.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // payload.sub = userId from JWT
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      tenantId: payload.tenantId, // May be undefined if not in JWT
    };
  }
}
