import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PriceService } from '../services/PriceService';
import { DEFAULT_USD_AMOUNT_FOR_RATES, SUPPORTED_CURRENCIES } from '../config';

const ratesQuerySchema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  quoteCurrency: z.enum(SUPPORTED_CURRENCIES),
}).refine(
  (data) => data.baseCurrency !== data.quoteCurrency,
  { message: 'baseCurrency and quoteCurrency must be different' },
);

const estimateQuerySchema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  quoteCurrency: z.enum(SUPPORTED_CURRENCIES),
  amount: z.coerce.number().positive().optional(),
  amountUsd: z.coerce.number().positive().optional(),
}).refine(
  (data) => data.baseCurrency !== data.quoteCurrency,
  { message: 'baseCurrency and quoteCurrency must be different' },
);

export function ratesRoutes(fastify: FastifyInstance, priceService: PriceService) {
  fastify.get('/getRates', async (request, reply) => {
    const parsed = ratesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { baseCurrency, quoteCurrency } = parsed.data;
    const rates = priceService.getCachedRates(baseCurrency, quoteCurrency);
    return { rates };
  });

  fastify.get('/estimate', async (request, reply) => {
    const parsed = estimateQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { baseCurrency, quoteCurrency } = parsed.data;
    let amount = parsed.data.amount;

    // Convert amountUsd → token amount using cached price
    if (amount == null) {
      const amountUsd = parsed.data.amountUsd ?? DEFAULT_USD_AMOUNT_FOR_RATES;

      if (baseCurrency === 'USDT') {
        amount = amountUsd;
      } else {
        const cachedRates = priceService.getCachedRates(baseCurrency, 'USDT');
        const usdRate = cachedRates.length > 0
          ? cachedRates.reduce((sum, r) => sum + r.rate, 0) / cachedRates.length
          : null;

        if (usdRate !== null && usdRate > 0) {
          amount = amountUsd / usdRate;
        } else {
          return reply.status(503).send({ error: 'Price data not yet available for USD conversion' });
        }
      }
    }

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
