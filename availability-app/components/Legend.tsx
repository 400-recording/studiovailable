import React from 'react';

export default function Legend() {
  const items = [
    { color: 'bg-available', label: 'Available' },
    { color: 'bg-maybe', label: 'Maybe' },
    { color: 'bg-unavailable', label: 'Unavailable' },
    { color: 'bg-booked', label: 'Booked (Session)' },
    { color: 'bg-unset', label: 'Not Set' },
  ];

  return (
    <div className="flex items-center gap-6 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${item.color}`} />
          <span className="text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
