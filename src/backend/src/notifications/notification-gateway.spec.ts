import { Test, TestingModule } from '@nestjs/testing';
import { NotificationGateway } from './notification-gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany: jest.fn(),
            },
            notification: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should find mutual accepted friends querying friendship table in both directions', async () => {
    (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
      { requester_id: 1, addressee_id: 2 },
      { requester_id: 5, addressee_id: 1 },
    ]);

    const friends = await (gateway as any).findFriend(1);

    expect(prisma.friendship.findMany).toHaveBeenCalledWith({
      where: {
        status: 'accepted',
        OR: [{ requester_id: 1 }, { addressee_id: 1 }],
      },
      select: { requester_id: true, addressee_id: true },
    });

    expect(friends).toEqual([
      { friend_id: 2, follower_id: 2 },
      { friend_id: 5, follower_id: 5 },
    ]);
  });
});
