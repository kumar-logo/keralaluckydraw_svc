import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const CHAT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'chat');
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export const chatUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(CHAT_UPLOAD_DIR)) {
        mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
      }
      cb(null, CHAT_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = MIME_EXT[file.mimetype];
      if (!ext) {
        cb(new BadRequestException('Invalid image type'), '');
        return;
      }
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (MIME_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Invalid image type'), false);
    }
  },
};

export const chatImageUrl = (file: Express.Multer.File): string =>
  `/uploads/chat/${file.filename}`;

export const removeChatUpload = (filePath: string): Promise<void> =>
  unlink(filePath).catch(() => undefined);
