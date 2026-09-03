import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class UsersService 
{
    constructor (private prisma: PrismaService) {}

    async getUserByEmail(email: string)
    {
        const user = await this.prisma.user.findUnique({
            where:
            {
                email:email
            },
        });
        if (!user)
            throw new NotFoundException('User not found');
        return user;
    }

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
	
	async getUser(id: number)
	{
		const user = await this.prisma.user.findUnique({
            where: {
				id: id
			}
		});
        if (!user)
            throw new NotFoundException('User not found');
        return user;
	}
}
