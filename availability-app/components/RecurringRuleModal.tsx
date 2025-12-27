import React, { useState } from 'react';
import { SlotStatus } from '@/lib/availability';

interface RecurringRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: RecurringRule) => void;
}

export interface RecurringRule {
  status: 'Available' | 'Maybe' | 'Unavailable';
  startTime: string;
  endTime: string;
  days: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  const h = hour.toString().padStart(2, '0');
  return `${h}:${min}`;
});

export default function RecurringRuleModal({
  isOpen,
  onClose,
  onSave,
}: RecurringRuleModalProps) {
  const [status, setStatus] = useState<'Available' | 'Maybe' | 'Unavailable'>('Available');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDays.length === 0) {
      alert('Please select at least one day');
      return;
    }

    onSave({
      status,
      startTime,
      endTime,
      days: selectedDays,
      effectiveFrom: effectiveFrom || undefined,
      effectiveUntil: effectiveUntil || undefined,
    });

    // Reset form
    setStatus('Available');
    setStartTime('09:00');
    setEndTime('17:00');
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setEffectiveFrom('');
    setEffectiveUntil('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-6">Set Recurring Availability</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Status selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Status</label>
            <div className="flex gap-2">
              {(['Available', 'Maybe', 'Unavailable'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`status-pill ${s.toLowerCase()} ${status === s ? 'active' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Start Time</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="select w-full"
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">End Time</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="select w-full"
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Days selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Days</label>
            <div className="checkbox-group">
              {DAYS.map((day) => (
                <label
                  key={day}
                  className={`checkbox-label ${selectedDays.includes(day) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Weekdays
            </button>
            <button
              type="button"
              onClick={() => setSelectedDays(['Sat', 'Sun'])}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Weekends
            </button>
            <button
              type="button"
              onClick={() => setSelectedDays(DAYS)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Every day
            </button>
          </div>

          {/* Effective date range (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Effective From <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Effective Until <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="date"
                value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
