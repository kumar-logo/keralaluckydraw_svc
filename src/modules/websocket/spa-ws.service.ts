import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../entities/announcement.entity';
import { ConfigLoaderService } from '../config/config-loader.service';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { Server as HttpServer } from 'http';
import { Duplex } from 'stream';

const MAGIC = Buffer.from('Diya');
const CMD_HEARTBEAT = 700;
const CMD_SYSTEM_MSG = 100;

@Injectable()
export class SpaWsService implements OnModuleInit {
  private readonly logger = new Logger('SpaWebSocket');
  private wss: WebSocket.Server;
  private clients = new Set<WebSocket>();

  constructor(
    @InjectRepository(Announcement)
    private announcementRepo: Repository<Announcement>,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  onModuleInit() {
    this.wss = new WebSocket.Server({ noServer: true });
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
    this.logger.log('SPA WebSocket service initialized');
  }

  attachToServer(httpServer: HttpServer) {
    httpServer.on(
      'upgrade',
      (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = req.url;
        if (
          url !== undefined &&
          url.startsWith('/user/service/info/ws') &&
          !url.includes('EIO=')
        ) {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit('connection', ws, req);
          });
        }
      },
    );
    this.logger.log(
      'Raw WebSocket attached to HTTP server at /user/service/info/ws',
    );
  }

  private async handleConnection(ws: WebSocket) {
    this.clients.add(ws);
    this.logger.log(`SPA client connected (${this.clients.size} total)`);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.logger.debug(`SPA client disconnected (${this.clients.size} total)`);
    });

    ws.on('error', (err) => {
      this.logger.error(`WebSocket error: ${err.message}`);
      this.clients.delete(ws);
    });

    await this.pushAnnouncements(ws);
  }

  private handleMessage(ws: WebSocket, data: Buffer) {
    try {
      if (data.length < 12) return;

      const magic = data.subarray(0, 4);
      if (!magic.equals(MAGIC)) return;

      const cmd = data.readUInt32BE(4);

      if (cmd === CMD_HEARTBEAT) {
        const pong = this.encodeFrame(CMD_HEARTBEAT, { ts: Date.now() });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(pong);
        }
      }
    } catch (err) {
      this.logger.error(
        `Error handling WS message: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async pushAnnouncements(ws: WebSocket) {
    try {
      const now = new Date();
      const announcements = await this.announcementRepo.find({
        where: { status: 1 },
        order: { sortOrder: 'DESC', id: 'DESC' },
      });

      const active = announcements.filter((a) => {
        if (a.startTime && a.startTime > now) return false;
        if (a.endTime && a.endTime < now) return false;
        return true;
      });

      if (active.length === 0) {
        const marquee = await this.configLoader.getMarqueeText();
        if (marquee) {
          const items = [{ type: 'system', content: marquee }];
          const frame = this.encodeFrame(CMD_SYSTEM_MSG, items);
          if (ws.readyState === WebSocket.OPEN) ws.send(frame);
        }
        return;
      }

      const items = active.map((a) => ({
        type: 'system',
        content: a.content,
      }));

      const frame = this.encodeFrame(CMD_SYSTEM_MSG, items);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    } catch (err) {
      this.logger.error(
        `Error pushing announcements: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async broadcastAnnouncements() {
    try {
      const now = new Date();
      const announcements = await this.announcementRepo.find({
        where: { status: 1 },
        order: { sortOrder: 'DESC', id: 'DESC' },
      });

      const active = announcements.filter((a) => {
        if (a.startTime && a.startTime > now) return false;
        if (a.endTime && a.endTime < now) return false;
        return true;
      });

      const items =
        active.length > 0
          ? active.map((a) => ({
              type: 'system',
              content: a.content,
            }))
          : [];

      if (items.length === 0) {
        const marquee = await this.configLoader.getMarqueeText();
        if (marquee) {
          items.push({ type: 'system', content: marquee });
        }
      }

      if (items.length === 0) return;

      const frame = this.encodeFrame(CMD_SYSTEM_MSG, items);
      for (const ws of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frame);
        }
      }
      this.logger.log(
        `Broadcasted announcements to ${this.clients.size} clients`,
      );
    } catch (err) {
      this.logger.error(
        `Error broadcasting: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async broadcastBigWin(contents: string[]) {
    if (!contents || contents.length === 0) return;

    const items = contents.map((content) => ({ type: 'bigwin', content }));
    const frame = this.encodeFrame(CMD_SYSTEM_MSG, items);
    let sent = 0;
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
        sent++;
      }
    }
    this.logger.log(
      `Broadcasted ${items.length} big-win(s) to ${sent} clients`,
    );
  }

  getOnlineCount(): number {
    return this.clients.size;
  }

  private encodeFrame(cmd: number, payload: unknown): Buffer {
    const json = JSON.stringify(payload);
    const jsonBuf = Buffer.from(json, 'utf-8');
    const frame = Buffer.alloc(12 + jsonBuf.length);
    MAGIC.copy(frame, 0);
    frame.writeUInt32BE(cmd, 4);
    frame.writeUInt32BE(jsonBuf.length, 8);
    jsonBuf.copy(frame, 12);
    return frame;
  }
}
