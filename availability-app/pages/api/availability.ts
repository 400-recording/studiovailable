import type { NextApiRequest, NextApiResponse } from 'next';
import { parseISO, startOfDay, endOfDay, addDays } from 'date-fns';
import {
  getEngineers,
  getAvailabilityRules,
  getSessions,
} from '@/lib/airtable';
import {
  calculateAvailability,
  getAvailabilitySummary,
  AvailabilitySummary,
  DayAvailability,
} from '@/lib/availability';

interface AvailabilityResponse {
  date: string;
  start_time?: string;
  end_time?: string;
  summary?: AvailabilitySummary;
  engineers?: Record<string, DayAvailability[]>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AvailabilityResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', date: '' });
  }

  try {
    const { date, start, end, engineer, detailed } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        error: 'Date parameter required (YYYY-MM-DD format)',
        date: '',
      });
    }

    const targetDate = parseISO(date);
    const startDate = startOfDay(targetDate);
    const endDate = endOfDay(targetDate);

    // Fetch all data
    const engineers = await getEngineers();
    
    // Filter by specific engineer if requested
    const targetEngineers = engineer
      ? engineers.filter(
          (e) =>
            e.name.toLowerCase() === (engineer as string).toLowerCase() ||
            e.id === engineer
        )
      : engineers;

    if (targetEngineers.length === 0) {
      return res.status(404).json({
        error: `Engineer "${engineer}" not found`,
        date,
      });
    }

    // Build availability map for each engineer
    const engineersAvailability = new Map<string, DayAvailability[]>();

    for (const eng of targetEngineers) {
      const rules = await getAvailabilityRules(eng.id);
      const sessions = await getSessions(
        startDate.toISOString(),
        addDays(endDate, 1).toISOString(),
        eng.id
      );

      const availability = calculateAvailability(
        rules,
        sessions,
        startDate,
        endDate
      );

      engineersAvailability.set(eng.name, availability);
    }

    // If time range specified, return summary
    if (start && end) {
      const summary = getAvailabilitySummary(
        engineersAvailability,
        date,
        start as string,
        end as string
      );

      return res.status(200).json({
        date,
        start_time: start as string,
        end_time: end as string,
        summary,
      });
    }

    // If detailed view requested, return full slot data
    if (detailed === 'true') {
      const engineersData: Record<string, DayAvailability[]> = {};
      for (const [name, avail] of engineersAvailability.entries()) {
        engineersData[name] = avail;
      }

      return res.status(200).json({
        date,
        engineers: engineersData,
      });
    }

    // Default: return summary for entire day
    const summary = getAvailabilitySummary(
      engineersAvailability,
      date,
      '00:00',
      '23:59'
    );

    return res.status(200).json({
      date,
      summary,
    });
  } catch (error) {
    console.error('Error querying availability:', error);
    return res.status(500).json({
      error: 'Failed to query availability',
      date: '',
    });
  }
}
