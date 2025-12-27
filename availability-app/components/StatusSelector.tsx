import React from 'react';
import { SlotStatus } from '@/lib/availability';

interface StatusSelectorProps {
  selected: SlotStatus;
  onSelect: (status: SlotStatus) => void;
}

const STATUSES: { value: SlotStatus; label: string; description: string }[] = [
  { value: 'Available', label: 'Available', description: 'Ready to work' },
  { value: 'Maybe', label: 'Maybe', description: 'Possibly available' },
  { value: 'Unavailable', label: 'Unavailable', description: 'Not available' },
];

export default function StatusSelector({ selected, onSelect }: StatusSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400 mr-2">Paint mode:</span>
      {STATUSES.map((status) => (
        <button
          key={status.value}
          onClick={() => onSelect(status.value)}
          className={`status-pill ${status.value.toLowerCase()} ${
            selected === status.value ? 'active' : ''
          }`}
          title={status.description}
        >
          {status.label}
        </button>
      ))}
    </div>
  );
}
