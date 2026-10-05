import { Test, TestingModule } from '@nestjs/testing';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

describe('AssetsController', () => {
  let controller: AssetsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [AssetsService],
    }).compile();
    controller = app.get<AssetsController>(AssetsController);
  });

  it('resolves its service from the Nest container', () => {
    expect(controller.list().length).toBeGreaterThan(0);
  });

  it('discloses allocated metal honestly', () => {
    const paxg = controller.list().find((a) => a.asset.symbol === 'PAXG')!;
    expect(paxg.disclosure).toMatch(/Allocated/);
    expect(paxg.disclosure).toMatch(/2026-09-30/);
  });

  it('never lets a synthetic token read as gold', () => {
    const fake = controller.list().find((a) => a.asset.symbol === 'XAU')!;
    expect(fake.disclosure).toMatch(/No physical metal/i);
    expect(fake.asset.trust.verifiedTier).toBe('unverified');
  });
});
