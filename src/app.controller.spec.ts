import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = app.get<AppController>(AppController);
  });

  it('is defined and returns an API health payload at the root path', () => {
    expect(controller).toBeDefined();
    expect(controller.health()).toEqual({
      status: 'ok',
      service: 'keralaluckydraw-svc',
    });
  });
});
