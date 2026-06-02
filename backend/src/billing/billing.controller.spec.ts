jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', basic: 'basic', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

jest.mock('stripe');

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: { handleEvent: jest.Mock };
  let mockConstructEvent: jest.Mock;

  beforeEach(async () => {
    mockConstructEvent = jest.fn();
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () => ({ webhooks: { constructEvent: mockConstructEvent } }) as unknown as Stripe,
    );

    billingService = { handleEvent: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'STRIPE_SECRET_KEY' ? 'sk_test' : 'whsec_test',
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(BillingController);
  });

  it('throws BadRequestException on invalid Stripe signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found');
    });
    const req = { rawBody: Buffer.from('{}') } as never;

    await expect(controller.handleWebhook('bad-sig', req)).rejects.toThrow(BadRequestException);
  });

  it('returns { received: true } and delegates to BillingService on valid event', async () => {
    const fakeEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;
    mockConstructEvent.mockReturnValue(fakeEvent);

    const req = { rawBody: Buffer.from('{}') } as never;
    const result = await controller.handleWebhook('valid-sig', req);

    expect(billingService.handleEvent).toHaveBeenCalledWith(fakeEvent);
    expect(result).toEqual({ received: true });
  });

  it('throws BadRequestException when rawBody is missing', async () => {
    const req = { rawBody: undefined } as never;

    await expect(controller.handleWebhook('sig', req)).rejects.toThrow(BadRequestException);
  });
});
