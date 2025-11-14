import { z } from 'zod';

export const probabilitySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1)
    .describe('Explanation for why the message is considered relevant / not relevant'),
  probability: z
    .number()
    .min(0)
    .max(1)
    .describe('Likelihood that the message is relevant (between 0 and 1; > 0.5 indicates related)'),
});

export type Probability = z.infer<typeof probabilitySchema>;

