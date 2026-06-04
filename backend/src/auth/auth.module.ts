import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtSseStrategy } from './strategies/jwt-sse.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, JwtSseStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
