import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import StatusSelector from '@/components/StatusSelector';
import EngineerSelector from '@/components/EngineerSelector';
import RecurringRuleModal, { RecurringRule } from '@/components/RecurringRuleModal';
import Legend from '@/components/Legend';
import Toast from '@/components/Toast';
import { Engineer } from '@/lib/airtable';
import { DayAvailability, SlotStatus } from '@/lib/availability';

export default function Home() {
  // State
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedStatus, setSelectedStatus] = useState<SlotStatus>('Available');
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch engineers on mount
  useEffect(() => {
    fetchEngineers();
  }, []);

  // Fetch availability when engineer or week changes
  useEffect(() => {
    if (selectedEngineer) {
      fetchAvailability();
    }
  }, [selectedEngineer, weekStart]);

  const fetchEngineers = async () => {
    try {
      const res = await fetch('/api/engineers');
      const data = await res.json();
      setEngineers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching engineers:', error);
      setToast({ message: 'Failed to load engineers', type: 'error' });
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedEngineer) return;

    setLoading(true);
    try {
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      
      const res = await fetch(
        `/api/availability?date=${startDate}&engineer=${encodeURIComponent(
          selectedEngineer.name
        )}&detailed=true`
      );
      const data = await res.json();

      if (data.engineers && data.engineers[selectedEngineer.name]) {
        setAvailability(data.engineers[selectedEngineer.name]);
      } else {
        // Generate empty availability for the week
        const emptyAvailability: DayAvailability[] = [];
        for (let i = 0; i < 7; i++) {
          const date = addDays(weekStart, i);
          emptyAvailability.push({
            date: format(date, 'yyyy-MM-dd'),
            dayName: format(date, 'EEE'),
            slots: Array.from({ length: 48 }, (_, j) => ({
              time: `${Math.floor(j / 2)
                .toString()
                .padStart(2, '0')}:${j % 2 === 0 ? '00' : '30'}`,
              datetime: new Date(date.setHours(Math.floor(j / 2), j % 2 === 0 ? 0 : 30)).toISOString(),
              status: 'Blank' as SlotStatus,
            })),
          });
        }
        setAvailability(emptyAvailability);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setToast({ message: 'Failed to load availability', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSlotsSelected = async (slots: { date: string; time: string }[]) => {
    if (!selectedEngineer || slots.length === 0 || selectedStatus === 'Blank' || selectedStatus === 'Booked') {
      return;
    }

    setSaving(true);
    
    try {
      // Group consecutive slots by date to create minimal rules
      const rulesByDate = new Map<string, string[]>();
      slots.forEach(({ date, time }) => {
        if (!rulesByDate.has(date)) {
          rulesByDate.set(date, []);
        }
        rulesByDate.get(date)!.push(time);
      });

      const rules: any[] = [];

      rulesByDate.forEach((times, date) => {
        // Sort times and find consecutive ranges
        const sortedTimes = times.sort();
        const ranges: { start: string; end: string }[] = [];
        let rangeStart = sortedTimes[0];
        let rangeEnd = sortedTimes[0];

        for (let i = 1; i < sortedTimes.length; i++) {
          const prevMinutes = timeToMinutes(rangeEnd);
          const currMinutes = timeToMinutes(sortedTimes[i]);

          if (currMinutes - prevMinutes === 30) {
            rangeEnd = sortedTimes[i];
          } else {
            ranges.push({ start: rangeStart, end: addMinutesToTime(rangeEnd, 30) });
            rangeStart = sortedTimes[i];
            rangeEnd = sortedTimes[i];
          }
        }
        ranges.push({ start: rangeStart, end: addMinutesToTime(rangeEnd, 30) });

        // Create rules for each range
        ranges.forEach(({ start, end }) => {
          rules.push({
            engineerId: selectedEngineer.id,
            status: selectedStatus,
            ruleType: 'one-time',
            startDateTime: `${date}T${start}:00`,
            endDateTime: `${date}T${end}:00`,
            source: 'web_app',
          });
        });
      });

      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setToast({ message: `Set ${slots.length} slots as ${selectedStatus}`, type: 'success' });
      
      // Refresh availability
      fetchAvailability();
    } catch (error) {
      console.error('Error saving availability:', error);
      setToast({ message: 'Failed to save availability', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRecurringRuleSave = async (rule: RecurringRule) => {
    if (!selectedEngineer) return;

    setSaving(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerId: selectedEngineer.id,
          status: rule.status,
          ruleType: 'recurring',
          startTime: rule.startTime,
          endTime: rule.endTime,
          recurrenceDays: rule.days,
          effectiveFrom: rule.effectiveFrom,
          effectiveUntil: rule.effectiveUntil,
          source: 'web_app',
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setToast({ message: 'Recurring rule saved', type: 'success' });
      fetchAvailability();
    } catch (error) {
      console.error('Error saving recurring rule:', error);
      setToast({ message: 'Failed to save recurring rule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart((prev) =>
      direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1)
    );
  };

  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Engineer Availability</h1>
            <p className="text-slate-400 mt-1">Click and drag to set availability</p>
          </div>
          <EngineerSelector
            engineers={engineers}
            selected={selectedEngineer}
            onSelect={setSelectedEngineer}
            loading={loading && engineers.length === 0}
          />
        </div>

        {selectedEngineer && (
          <>
            {/* Controls bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/30 rounded-xl p-4">
              <StatusSelector selected={selectedStatus} onSelect={setSelectedStatus} />
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsRecurringModalOpen(true)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Set Recurring
                </button>
              </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateWeek('prev')}
                className="btn btn-secondary flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">
                  {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                </h2>
                <button onClick={goToCurrentWeek} className="text-sm text-blue-400 hover:text-blue-300">
                  Today
                </button>
              </div>

              <button
                onClick={() => navigateWeek('next')}
                className="btn btn-secondary flex items-center gap-1"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Calendar */}
            <WeeklyCalendar
              availability={availability}
              selectedStatus={selectedStatus}
              onSlotsSelected={handleSlotsSelected}
              loading={loading}
            />

            {/* Legend */}
            <div className="flex justify-center">
              <Legend />
            </div>
          </>
        )}

        {!selectedEngineer && !loading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👆</div>
            <h2 className="text-xl text-white mb-2">Select an engineer to get started</h2>
            <p className="text-slate-400">Choose from the dropdown above to view and edit availability</p>
          </div>
        )}
      </div>

      {/* Recurring rule modal */}
      <RecurringRuleModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        onSave={handleRecurringRuleSave}
      />

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 left-6 bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Saving...
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
