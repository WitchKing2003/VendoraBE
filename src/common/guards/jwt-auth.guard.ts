import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global JWT guard. Routes are protected by default;
 * mark public routes with `@Public()`.
 *
 * Public routes accept anonymous requests, but still validate a bearer token
 * when one is sent, so endpoints like `GET /products` can personalize the
 * response for a signed-in admin.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const hasToken = Boolean(request.headers.authorization);

    if (isPublic && !hasToken) {
      return true;
    }

    return super.canActivate(context);
  }
}
