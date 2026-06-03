import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LearningGoalAdminController } from './learning-goal-admin.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LearningGoalAdminController],
})
export class AdminModule {}
