import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'Internal server error';
    let code = 500;

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const resObj = res as {
          code?: number;
          msg?: string;
          message?: string | string[];
        };
        code = resObj.code === undefined ? httpStatus : resObj.code;
        const rawMessage = resObj.msg ?? resObj.message ?? exception.message;
        message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
      } else if (typeof res === 'string') {
        message = res;
        code = httpStatus;
      } else {
        code = httpStatus;
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      if (
        exception.message?.includes('ECONNREFUSED') ||
        exception.message?.includes('ER_NO_SUCH_TABLE')
      ) {
        message = 'Database connection failed — check MySQL is running';
        code = 503;
      } else {
        message = exception.message;
      }
      this.logger.error(exception.message, exception.stack);
    }

    response.status(HttpStatus.OK).json({ code, msg: message, data: null });
  }
}
