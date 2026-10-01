import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { paginate, type PaginatedResult } from '../../common/utils/pagination.util.js';
import { USER_PUBLIC_SELECT, type PublicUser } from './user.select.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UsersQueryDto } from './dto/users-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UsersQueryDto): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password: _password, ...data } = dto;
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    };

    if (dto.password) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('currentPassword is required to change your password');
      }
      const valid = await compare(dto.currentPassword, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      data.password = await hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async remove(id: string): Promise<{ data: null; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user._count.orders > 0) {
      throw new ConflictException(
        'Users with orders cannot be deleted; deactivate the account instead',
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { data: null, message: 'User deleted' };
  }
}
