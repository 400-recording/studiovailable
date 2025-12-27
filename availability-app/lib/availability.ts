import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  addMinutes,
  isWithinInterval,
  isBefore,
  isAfter,
  getDay,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { AvailabilityRule, Session } from './airtable';

const TIMEZONE = process.env.TIMEZONE || 'America/New_York';
const SLOT_MINUTES = 30;

export type SlotStatus = 'Available' | 'Maybe' | 'Unavailable' | 'Booked' | 'Blank';

export interface TimeSlot {
  time: string; // "HH:mm" format
  datetime: string; // Full ISO datetime
  status: SlotStatus;
  ruleId?: string;
  sessionId?: string;
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD" format
  dayName: string;
  slots: TimeSlot[];
}

const DAY_MAP: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

// Generate all 30-minute slots for a given date
function generateDaySlots(date: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayStart = startOfDay(date);

  for (let minutes = 0; minutes < 24 * 60; minutes += SLOT_MINUTES) {
    const slotTime = addMinutes(dayStart, minutes);
    slots.push({
      time: format(slotTime, 'HH:mm'),
      datetime: slotTime.toISOString(),
      status: 'Blank',
    });
  }

  return slots;
}

// Check if a recurring rule applies to a specific date
function recurringRuleApplies(rule: AvailabilityRule, date: Date): boolean {
  if (rule.ruleType !== 'recurring') return false;
  if (!rule.recurrenceDays || rule.recurrenceDays.length === 0) return false;

  const dayOfWeek = getDay(date);
  const dayName = DAY_MAP[dayOfWeek];

  if (!rule.recurrenceDays.includes(dayName)) return false;

  // Check effective date range
  if (rule.effectiveFrom) {
    const effectiveFrom = parseISO(rule.effectiveFrom);
    if (isBefore(date, effectiveFrom)) return false;
  }

  if (rule.effectiveUntil) {
    const effectiveUntil = parseISO(rule.effectiveUntil);
    if (isAfter(date, effectiveUntil)) return false;
  }

  return true;
}

// Check if a one-time rule applies to a specific slot
function oneTimeRuleApplies(
  rule: AvailabilityRule,
  slotStart: Date,
  slotEnd: Date
): boolean {
  if (rule.ruleType !== 'one-time') return false;
  if (!rule.startDateTime || !rule.endDateTime) return false;

  const ruleStart = parseISO(rule.startDateTime);
  const ruleEnd = parseISO(rule.endDateTime);

  // Slot overlaps with rule if slot starts before rule ends AND slot ends after rule starts
  return isBefore(slotStart, ruleEnd) && isAfter(slotEnd, ruleStart);
}

// Check if a recurring rule applies to a specific slot
function recurringSlotApplies(
  rule: AvailabilityRule,
  date: Date,
  slotTime: string
): boolean {
  if (!rule.startTime || !rule.endTime) return false;

  // Handle overnight rules (e.g., 22:00 to 04:00)
  const slotMinutes = timeToMinutes(slotTime);
  const startMinutes = timeToMinutes(rule.startTime);
  let endMinutes = timeToMinutes(rule.endTime);

  // If end time is less than start time, it crosses midnight
  if (endMinutes <= startMinutes) {
    // Slot is within range if it's after start OR before end
    return slotMinutes >= startMinutes || slotMinutes < endMinutes;
  }

  return slotMinutes >= startMinutes && slotMinutes < endMinutes;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if a session covers a specific slot
function sessionCoversSlot(
  session: Session,
  slotStart: Date,
  slotEnd: Date
): boolean {
  const sessionStart = parseISO(session.start);
  const sessionEnd = parseISO(session.end);

  return isBefore(slotStart, sessionEnd) && isAfter(slotEnd, sessionStart);
}

// Calculate availability for a date range
export function calculateAvailability(
  rules: AvailabilityRule[],
  sessions: Session[],
  startDate: Date,
  endDate: Date
): DayAvailability[] {
  const result: DayAvailability[] = [];
  let currentDate = startOfDay(startDate);
  const end = endOfDay(endDate);

  while (isBefore(currentDate, end) || currentDate.getTime() === end.getTime()) {
    const slots = generateDaySlots(currentDate);
    const dateStr = format(currentDate, 'yyyy-MM-dd');

    // Sort rules by updatedAt timestamp (ascending so latest comes last and wins)
    const sortedRules = [...rules].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );

    // Apply rules to each slot
    for (const slot of slots) {
      const slotStart = parseISO(slot.datetime);
      const slotEnd = addMinutes(slotStart, SLOT_MINUTES);

      // Apply rules in order (latest wins due to overwriting)
      for (const rule of sortedRules) {
        // Check one-time rules
        if (rule.ruleType === 'one-time' && oneTimeRuleApplies(rule, slotStart, slotEnd)) {
          slot.status = rule.status;
          slot.ruleId = rule.id;
        }

        // Check recurring rules
        if (
          rule.ruleType === 'recurring' &&
          recurringRuleApplies(rule, currentDate) &&
          recurringSlotApplies(rule, currentDate, slot.time)
        ) {
          slot.status = rule.status;
          slot.ruleId = rule.id;
        }
      }

      // Sessions always override availability (engineer is booked)
      for (const session of sessions) {
        if (sessionCoversSlot(session, slotStart, slotEnd)) {
          slot.status = 'Booked';
          slot.sessionId = session.id;
          break;
        }
      }
    }

    result.push({
      date: dateStr,
      dayName: format(currentDate, 'EEE'),
      slots,
    });

    currentDate = addMinutes(currentDate, 24 * 60);
  }

  return result;
}

// Get availability summary for n8n queries
export interface AvailabilitySummary {
  available: string[];
  maybe: string[];
  unavailable: string[];
  booked: string[];
  not_set: string[];
}

export function getAvailabilitySummary(
  engineersAvailability: Map<string, DayAvailability[]>,
  targetDate: string,
  startTime: string,
  endTime: string
): AvailabilitySummary {
  const summary: AvailabilitySummary = {
    available: [],
    maybe: [],
    unavailable: [],
    booked: [],
    not_set: [],
  };

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (const [engineerName, days] of engineersAvailability.entries()) {
    const targetDay = days.find((d) => d.date === targetDate);
    if (!targetDay) {
      summary.not_set.push(engineerName);
      continue;
    }

    // Check all slots in the time range
    const relevantSlots = targetDay.slots.filter((slot) => {
      const slotMinutes = timeToMinutes(slot.time);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });

    if (relevantSlots.length === 0) {
      summary.not_set.push(engineerName);
      continue;
    }

    // Determine overall status for the time range
    // Priority: Booked > Unavailable > Maybe > Blank > Available
    const statuses = relevantSlots.map((s) => s.status);

    if (statuses.includes('Booked')) {
      summary.booked.push(engineerName);
    } else if (statuses.includes('Unavailable')) {
      summary.unavailable.push(engineerName);
    } else if (statuses.some((s) => s === 'Blank')) {
      // If any slot is blank, they haven't fully set availability
      if (statuses.every((s) => s === 'Blank')) {
        summary.not_set.push(engineerName);
      } else if (statuses.includes('Maybe')) {
        summary.maybe.push(engineerName);
      } else if (statuses.includes('Available')) {
        summary.available.push(engineerName);
      } else {
        summary.not_set.push(engineerName);
      }
    } else if (statuses.includes('Maybe')) {
      summary.maybe.push(engineerName);
    } else if (statuses.every((s) => s === 'Available')) {
      summary.available.push(engineerName);
    } else {
      summary.not_set.push(engineerName);
    }
  }

  return summary;
}
