import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PriceService } from '../services/PriceService';
import { SUPPORTED_CURRENCIES } from '../config';

const querySchema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  quoteCurrency: z.enum(SUPPORTED_CURRENCIES),
  amount: z.coerce.number().positive().optional().default(1),
}).refine(
  (data) => data.baseCurrency !== data.quoteCurrency,
  { message: 'baseCurrency and quoteCurrency must be different' },
);

export function ratesRoutes(fastify: FastifyInstance, priceService: PriceService) {
  fastify.get('/getRates', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { baseCurrency, quoteCurrency, amount } = parsed.data;
    const rates = await priceService.getRates(baseCurrency, quoteCurrency, amount);
    return { rates };
  });

  fastify.get('/estimate', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { baseCurrency, quoteCurrency, amount } = parsed.data;
    const rates = await priceService.getRates(baseCurrency, quoteCurrency, amount);

    if (rates.length === 0) {
      return reply.status(404).send({ error: 'No rates available' });
    }

    const sum = rates.reduce((acc, r) => acc + r.rate, 0);
    const averageRate = sum / rates.length;
    const bestRate = rates.reduce((best, r) => r.rate > best.rate ? r : best);

    return {
      baseCurrency,
      quoteCurrency,
      amount,
      averageRate,
      bestRate,
      rates,
    };
  });
}
