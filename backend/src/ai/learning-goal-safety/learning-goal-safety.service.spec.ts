jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { LearningGoalSafetyService } from './learning-goal-safety.service';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

describe('LearningGoalSafetyService', () => {
  let service: LearningGoalSafetyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        LearningGoalSafetyService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('sk-test') } },
      ],
    }).compile();
    service = module.get(LearningGoalSafetyService);
  });

  it('returns the parsed safety result for a benign goal', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: true },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.check('бережное отношение к книгам', 'user-1');

    expect(result).toEqual({ safe: true });
  });

  it('returns safe: false with a reason for an unsafe goal', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: false, reason: 'Тема не подходит для детской книги' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.check('something unsafe', 'user-1');

    expect(result).toEqual({ safe: false, reason: 'Тема не подходит для детской книги' });
  });

  it('passes the goal text into the prompt', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: true },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.check('любовь к чтению', 'user-1');

    const call = mockGenerateObject.mock.calls[0][0];
    expect(call.prompt).toContain('любовь к чтению');
  });
});
