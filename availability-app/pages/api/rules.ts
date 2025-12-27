import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getAvailabilityRules,
  createAvailabilityRule,
  deleteAvailabilityRule,
  batchCreateAvailabilityRules,
  AvailabilityRule,
} from '@/lib/airtable';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET': {
        const { engineerId } = req.query;
        const rules = await getAvailabilityRules(engineerId as string | undefined);
        return res.status(200).json(rules);
      }

      case 'POST': {
        const { rules } = req.body;
        
        // Support both single rule and batch creation
        if (Array.isArray(rules)) {
          const created = await batchCreateAvailabilityRules(rules);
          return res.status(201).json(created);
        } else {
          const rule = await createAvailabilityRule(req.body);
          return res.status(201).json(rule);
        }
      }

      case 'DELETE': {
        const { ruleId } = req.query;
        if (!ruleId || typeof ruleId !== 'string') {
          return res.status(400).json({ error: 'Rule ID required' });
        }
        await deleteAvailabilityRule(ruleId);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error handling availability rules:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}
