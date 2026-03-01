import { IsEmail, IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(150)
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(100)
    password!: string;

    @IsEnum(Role)
    role!: Role;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;
}
