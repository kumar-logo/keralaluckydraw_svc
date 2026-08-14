import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface TokenRequest {
  headers: { token?: string; authorization?: string };
  query?: { token?: string };
  user?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<TokenRequest>();
    const token = this.resolveToken(request);

    if (isPublic) {
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token);
          request.user = payload;
        } catch (err) {
          this.logger.debug(
            `Ignoring invalid token on public route: ${
              err instanceof Error ? err.message : 'unknown error'
            }`,
          );
        }
      }
      return true;
    }

    if (!token)
      throw new UnauthorizedException({ code: 701, msg: 'Token required' });

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException({
        code: 701,
        msg: 'Token expired or invalid',
      });
    }

    return true;
  }

  private resolveToken(request: TokenRequest): string | undefined {
    return (
      request.headers['token'] ||
      this.extractBearerToken(request) ||
      request.query?.token
    );
  }

  private extractBearerToken(request: TokenRequest): string | undefined {
    const authorization = request.headers.authorization;
    if (authorization === undefined) return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
