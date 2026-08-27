import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class UsersService 
{
    constructor (private prisma: PrismaService) {}

    async findUser(username: string)
    {
        const user = await this.prisma.user.findMany({
            where: {
                username: {
                    contains: username,
                    mode: 'insensitive', 
                },
            },
            select: {
                username: true,
            }
        });
        if (!user)
            throw new NotFoundException('User not found');
        return user;
    }
}
