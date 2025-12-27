import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID!
);

export const engineersTable = base(process.env.ENGINEERS_TABLE_ID!);
export const availabilityTable = base(process.env.AVAILABILITY_TABLE_ID!);
export const sessionsTable = base(process.env.SESSIONS_TABLE_ID!);

export interface Engineer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  active: boolean;
}

export interface AvailabilityRule {
  id: string;
  engineerId: string;
  engineerName?: string;
  status: 'Available' | 'Maybe' | 'Unavailable';
  ruleType: 'one-time' | 'recurring';
  startDateTime?: string;
  endDateTime?: string;
  startTime?: string;
  endTime?: string;
  recurrenceDays?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  source: 'web_app' | 'chatbot' | 'booking';
  updatedAt: string;
}

export interface Session {
  id: string;
  title: string;
  engineerId: string;
  engineerName?: string;
  start: string;
  end: string;
}

// Fetch all active engineers
export async function getEngineers(): Promise<Engineer[]> {
  const records = await engineersTable
    .select({
      filterByFormula: '{Active} = 1',
      fields: ['Name', 'Email', 'Phone# (E.164)', 'Active'],
    })
    .all();

  return records.map((record) => ({
    id: record.id,
    name: record.get('Name') as string,
    email: record.get('Email') as string | undefined,
    phone: record.get('Phone# (E.164)') as string | undefined,
    active: record.get('Active') as boolean,
  }));
}

// Fetch availability rules for an engineer
export async function getAvailabilityRules(
  engineerId?: string
): Promise<AvailabilityRule[]> {
  const filterFormula = engineerId
    ? `RECORD_ID() = '${engineerId}'`
    : '';

  const selectOptions: any = {
    fields: [
      'Engineer',
      'Status',
      'Rule_Type',
      'Start_DateTime',
      'End_DateTime',
      'Start_Time',
      'End_Time',
      'Recurrence_Days',
      'Effective_From',
      'Effective_Until',
      'Source',
      'Updated_Time',
    ],
  };

  if (engineerId) {
    selectOptions.filterByFormula = `FIND('${engineerId}', ARRAYJOIN({Engineer}))`;
  }

  const records = await availabilityTable.select(selectOptions).all();

  return records.map((record) => {
    const engineerField = record.get('Engineer') as string[] | undefined;
    return {
      id: record.id,
      engineerId: engineerField?.[0] || '',
      status: record.get('Status') as AvailabilityRule['status'],
      ruleType: record.get('Rule_Type') as AvailabilityRule['ruleType'],
      startDateTime: record.get('Start_DateTime') as string | undefined,
      endDateTime: record.get('End_DateTime') as string | undefined,
      startTime: record.get('Start_Time') as string | undefined,
      endTime: record.get('End_Time') as string | undefined,
      recurrenceDays: record.get('Recurrence_Days') as string[] | undefined,
      effectiveFrom: record.get('Effective_From') as string | undefined,
      effectiveUntil: record.get('Effective_Until') as string | undefined,
      source: record.get('Source') as AvailabilityRule['source'],
      updatedAt: record.get('Updated_Time') as string,
    };
  });
}

// Fetch sessions for engineers
export async function getSessions(
  startDate: string,
  endDate: string,
  engineerId?: string
): Promise<Session[]> {
  let filterFormula = `AND(
    IS_AFTER({Start}, '${startDate}'),
    IS_BEFORE({Start}, '${endDate}')
  )`;

  if (engineerId) {
    filterFormula = `AND(
      IS_AFTER({Start}, '${startDate}'),
      IS_BEFORE({Start}, '${endDate}'),
      FIND('${engineerId}', ARRAYJOIN({Engineer}))
    )`;
  }

  const records = await sessionsTable
    .select({
      filterByFormula: filterFormula,
      view: process.env.SESSIONS_VIEW_ID,
      fields: ['Title', 'Engineer', 'Start', 'End'],
    })
    .all();

  return records.map((record) => {
    const engineerField = record.get('Engineer') as string[] | undefined;
    return {
      id: record.id,
      title: record.get('Title') as string,
      engineerId: engineerField?.[0] || '',
      start: record.get('Start') as string,
      end: record.get('End') as string,
    };
  });
}

// Create a new availability rule
export async function createAvailabilityRule(
  rule: Omit<AvailabilityRule, 'id' | 'updatedAt'>
): Promise<AvailabilityRule> {
  const fields: any = {
    Engineer: [rule.engineerId],
    Status: rule.status,
    Rule_Type: rule.ruleType,
    Source: rule.source,
  };

  if (rule.ruleType === 'one-time') {
    fields.Start_DateTime = rule.startDateTime;
    fields.End_DateTime = rule.endDateTime;
  } else {
    fields.Start_Time = rule.startTime;
    fields.End_Time = rule.endTime;
    fields.Recurrence_Days = rule.recurrenceDays;
    if (rule.effectiveFrom) fields.Effective_From = rule.effectiveFrom;
    if (rule.effectiveUntil) fields.Effective_Until = rule.effectiveUntil;
  }

  const record = await availabilityTable.create(fields);

  const engineerField = record.get('Engineer') as string[] | undefined;
  return {
    id: record.id,
    engineerId: engineerField?.[0] || '',
    status: record.get('Status') as AvailabilityRule['status'],
    ruleType: record.get('Rule_Type') as AvailabilityRule['ruleType'],
    startDateTime: record.get('Start_DateTime') as string | undefined,
    endDateTime: record.get('End_DateTime') as string | undefined,
    startTime: record.get('Start_Time') as string | undefined,
    endTime: record.get('End_Time') as string | undefined,
    recurrenceDays: record.get('Recurrence_Days') as string[] | undefined,
    effectiveFrom: record.get('Effective_From') as string | undefined,
    effectiveUntil: record.get('Effective_Until') as string | undefined,
    source: record.get('Source') as AvailabilityRule['source'],
    updatedAt: new Date().toISOString(),
  };
}

// Delete an availability rule
export async function deleteAvailabilityRule(ruleId: string): Promise<void> {
  await availabilityTable.destroy(ruleId);
}

// Batch create availability rules
export async function batchCreateAvailabilityRules(
  rules: Omit<AvailabilityRule, 'id' | 'updatedAt'>[]
): Promise<AvailabilityRule[]> {
  const results: AvailabilityRule[] = [];
  
  // Airtable limits batch creates to 10 records at a time
  for (let i = 0; i < rules.length; i += 10) {
    const batch = rules.slice(i, i + 10);
    const records = await availabilityTable.create(
      batch.map((rule) => {
        const fields: any = {
          Engineer: [rule.engineerId],
          Status: rule.status,
          Rule_Type: rule.ruleType,
          Source: rule.source,
        };

        if (rule.ruleType === 'one-time') {
          fields.Start_DateTime = rule.startDateTime;
          fields.End_DateTime = rule.endDateTime;
        } else {
          fields.Start_Time = rule.startTime;
          fields.End_Time = rule.endTime;
          fields.Recurrence_Days = rule.recurrenceDays;
          if (rule.effectiveFrom) fields.Effective_From = rule.effectiveFrom;
          if (rule.effectiveUntil) fields.Effective_Until = rule.effectiveUntil;
        }

        return { fields };
      })
    );

    results.push(
      ...records.map((record) => {
        const engineerField = record.get('Engineer') as string[] | undefined;
        return {
          id: record.id,
          engineerId: engineerField?.[0] || '',
          status: record.get('Status') as AvailabilityRule['status'],
          ruleType: record.get('Rule_Type') as AvailabilityRule['ruleType'],
          startDateTime: record.get('Start_DateTime') as string | undefined,
          endDateTime: record.get('End_DateTime') as string | undefined,
          startTime: record.get('Start_Time') as string | undefined,
          endTime: record.get('End_Time') as string | undefined,
          recurrenceDays: record.get('Recurrence_Days') as string[] | undefined,
          effectiveFrom: record.get('Effective_From') as string | undefined,
          effectiveUntil: record.get('Effective_Until') as string | undefined,
          source: record.get('Source') as AvailabilityRule['source'],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }

  return results;
}
