import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

const goalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  ageRangeMin: z.number().int().min(1).max(18).default(1),
  ageRangeMax: z.number().int().min(1).max(18).default(18),
});

@Controller('admin/learning-goals')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LearningGoalAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.learningGoal.findMany({ orderBy: { title: 'asc' } });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    const dto = goalSchema.parse(body);
    return this.prisma.learningGoal.create({ data: dto });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const dto = goalSchema.parse(body);
    const existing = await this.prisma.learningGoal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    return this.prisma.learningGoal.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.learningGoal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.learningGoal.delete({ where: { id } });
  }
}
