import {
  Controller,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const ALLOWED_FOLDERS = [
  'banners',
  'avatars',
  'icons',
  'games',
  'popups',
  'casino',
  'lottery',
  'gateways',
  'config',
  'activities',
  'referral',
  'notifications',
];

const resolveFolder = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    return null;
  }
  return ALLOWED_FOLDERS.includes(value) ? value : null;
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Controller()
export class UploadController {
  @HttpCode(200)
  @Post('admin/api/v1/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const folder = resolveFolder(req.query.folder);
          if (!folder) {
            cb(null, UPLOAD_DIR);
            return;
          }
          const target = join(UPLOAD_DIR, folder);
          if (!existsSync(target)) {
            mkdirSync(target, { recursive: true });
          }
          cb(null, target);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const filename = `${uuidv4()}${ext}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validFolder = resolveFolder(folder);

    return {
      url: `/uploads/${validFolder ? `${validFolder}/` : ''}${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
