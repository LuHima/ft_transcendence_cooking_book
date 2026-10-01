import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
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
		return user;
	}

	async getUserByUsername(username: string)
	{
		const user = await this.prisma.user.findUnique({
			where:
			{
				username:username
			},
		});
		return user;
	}

	async getUserById(id: number)
	{
		const user = await this.prisma.user.findUnique({
			where:
			{
				id: id
			},
		});
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

	async getMe(id: number)
	{
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				username: true,
				email: true,
				role: true,
				avatar_url: true,
				first_name: true,
				last_name: true,
				birth_date: true,
				phone: true,
				address: true,
				city: true,
				postal_code: true,
				created_at: true,
			},
		});
		if (!user)
			throw new NotFoundException('User not found');
		return user;
	}

	async updateMe(id: number, updateUserDto: UpdateUserDto)
	{
		const data: Prisma.UserUpdateInput = { ...updateUserDto };
		if (updateUserDto.birth_date !== undefined) {
			if (updateUserDto.birth_date === '' || updateUserDto.birth_date === null) {
				data.birth_date = null;
			} else {
				data.birth_date = new Date(updateUserDto.birth_date);
			}
		}

		try {
			const updatedUser = await this.prisma.user.update({
				where: { id },
				data,
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					avatar_url: true,
					first_name: true,
					last_name: true,
					birth_date: true,
					phone: true,
					address: true,
					city: true,
					postal_code: true,
					created_at: true,
				},
			});
			return updatedUser;
		} catch (error: any) {
			if (error?.code === 'P2002') {
				throw new ConflictException('Username or email already in use');
			}
			throw new NotFoundException('User not found');
		}
	}
}
