import type { NextApiRequest, NextApiResponse } from 'next';
import { parseISO, format, addMinutes } from 'date-fns';
import {
  getEngineers,
  createAvailabilityRule,
  AvailabilityRule,
} from '@/lib/airtable';

interface ChatbotRequest {
  engineer: string; // Name or ID
  status: 'Available' | 'Maybe' | 'Unavailable';
  // For one-time rules
  date?: string; // YYYY-MM-DD
  start_time?: string; // HH:mm
  end_time?: string; // HH:mm
  // For recurring rules
  days?: string[]; // ['Mon', 'Tue', etc.]
  effective_from?: string; // YYYY-MM-DD
  effective_until?: string; // YYYY-MM-DD
}

interface ChatbotResponse {
  success: boolean;
  message: string;
  rule?: AvailabilityRule;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatbotResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      error: 'Use POST method',
    });
  }

  try {
    const body: ChatbotRequest = req.body;

    // Validate required fields
    if (!body.engineer || !body.status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        error: 'Engineer name and status are required',
      });
    }

    // Find the engineer
    const engineers = await getEngineers();
    const engineer = engineers.find(
      (e) =>
        e.name.toLowerCase() === body.engineer.toLowerCase() ||
        e.id === body.engineer
    );

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: `Engineer "${body.engineer}" not found`,
        error: 'Engineer not found',
      });
    }

    // Determine if this is a one-time or recurring rule
    const isRecurring = body.days && body.days.length > 0;

    if (isRecurring) {
      // Validate recurring rule fields
      if (!body.start_time || !body.end_time) {
        return res.status(400).json({
          success: false,
          message: 'Missing time fields',
          error: 'start_time and end_time are required for recurring rules',
        });
      }

      const rule = await createAvailabilityRule({
        engineerId: engineer.id,
        status: body.status,
        ruleType: 'recurring',
        startTime: body.start_time,
        endTime: body.end_time,
        recurrenceDays: body.days,
        effectiveFrom: body.effective_from,
        effectiveUntil: body.effective_until,
        source: 'chatbot',
      });

      const daysStr = body.days!.join(', ');
      return res.status(201).json({
        success: true,
        message: `Set ${engineer.name} as ${body.status} on ${daysStr} from ${body.start_time} to ${body.end_time}`,
        rule,
      });
    } else {
      // One-time rule
      if (!body.date || !body.start_time || !body.end_time) {
        return res.status(400).json({
          success: false,
          message: 'Missing fields',
          error: 'date, start_time, and end_time are required for one-time rules',
        });
      }

      // Construct full datetime strings
      const startDateTime = `${body.date}T${body.start_time}:00`;
      const endDateTime = `${body.date}T${body.end_time}:00`;

      // Handle overnight times (end time before start time)
      let adjustedEndDateTime = endDateTime;
      if (body.end_time < body.start_time) {
        // End time is on the next day
        const nextDay = format(
          addMinutes(parseISO(body.date), 24 * 60),
          'yyyy-MM-dd'
        );
        adjustedEndDateTime = `${nextDay}T${body.end_time}:00`;
      }

      const rule = await createAvailabilityRule({
        engineerId: engineer.id,
        status: body.status,
        ruleType: 'one-time',
        startDateTime,
        endDateTime: adjustedEndDateTime,
        source: 'chatbot',
      });

      return res.status(201).json({
        success: true,
        message: `Set ${engineer.name} as ${body.status} on ${body.date} from ${body.start_time} to ${body.end_time}`,
        rule,
      });
    }
  } catch (error) {
    console.error('Error processing chatbot request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update availability',
      error: 'Internal server error',
    });
  }
}
