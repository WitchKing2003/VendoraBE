import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { USER_PUBLIC_SELECT, type PublicUser } from '../users/user.select.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await hash(dto.password, 10),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone,
      },
      select: USER_PUBLIC_SELECT,
    });

    this.logger.log(`Registered new user ${user.email}`);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const { password: _password, ...publicUser } = user;
    return this.issueTokens(publicUser as PublicUser);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(refreshToken) },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!record.user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    // Rotation: revoke the used token before issuing a new pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.user);
  }

  async logout(refreshToken: string): Promise<{ data: null; message: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(refreshToken) },
    });

    if (record && !record.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
    }

    // Idempotent: logging out with an unknown token still succeeds.
    return { data: null, message: 'Logged out successfully' };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }

  private async issueTokens(user: PublicUser): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.refreshExpiresIn'),
      },
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { user, accessToken, refreshToken };
  }

  /** Refresh tokens are stored as SHA-256 hashes, never in plain text. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
