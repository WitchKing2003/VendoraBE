import { type ConfigService } from '@nestjs/config';
import { type AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import passportJwt from 'passport-jwt';

const { Strategy, ExtractJwt } = passportJwt;

export interface JwtPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
  firstName: string;
  lastName: string;
  iat?: number;
  exp?: number;
}

/** Validates `Authorization: Bearer <access token>` headers. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
  }
}
