import React from 'react';
import { Engineer } from '@/lib/airtable';

interface EngineerSelectorProps {
  engineers: Engineer[];
  selected: Engineer | null;
  onSelect: (engineer: Engineer) => void;
  loading?: boolean;
}

export default function EngineerSelector({
  engineers,
  selected,
  onSelect,
  loading = false,
}: EngineerSelectorProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="loading-shimmer h-10 w-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selected?.id || ''}
        onChange={(e) => {
          const engineer = engineers.find((eng) => eng.id === e.target.value);
          if (engineer) onSelect(engineer);
        }}
        className="select min-w-[200px]"
      >
        <option value="" disabled>
          Select engineer...
        </option>
        {engineers.map((engineer) => (
          <option key={engineer.id} value={engineer.id}>
            {engineer.name}
          </option>
        ))}
      </select>
    </div>
  );
}
