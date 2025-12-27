import type { NextApiRequest, NextApiResponse } from 'next';
import { getEngineers, Engineer } from '@/lib/airtable';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Engineer[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const engineers = await getEngineers();
    res.status(200).json(engineers);
  } catch (error) {
    console.error('Error fetching engineers:', error);
    res.status(500).json({ error: 'Failed to fetch engineers' });
  }
}
