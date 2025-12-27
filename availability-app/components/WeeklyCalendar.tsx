import React, { useState, useCallback, useRef, useEffect } from 'react';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { DayAvailability, SlotStatus, TimeSlot } from '@/lib/availability';

interface WeeklyCalendarProps {
  availability: DayAvailability[];
  selectedStatus: SlotStatus;
  onSlotsSelected: (slots: { date: string; time: string }[]) => void;
  loading?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DISPLAY_HOURS = [0, 4, 8, 12, 16, 20]; // Hours to show labels for

export default function WeeklyCalendar({
  availability,
  selectedStatus,
  onSlotsSelected,
  loading = false,
}: WeeklyCalendarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate time labels
  const timeLabels = HOURS.flatMap((hour) => [
    format(new Date(2024, 0, 1, hour, 0), 'h:mm a'),
    format(new Date(2024, 0, 1, hour, 30), 'h:mm a'),
  ]);

  const handleMouseDown = (dayIndex: number, slotIndex: number, slot: TimeSlot) => {
    if (slot.status === 'Booked') return;
    
    setIsDragging(true);
    setDragStart({ day: dayIndex, slot: slotIndex });
    setSelectedSlots(new Set([`${dayIndex}-${slotIndex}`]));
  };

  const handleMouseEnter = (dayIndex: number, slotIndex: number, slot: TimeSlot) => {
    if (!isDragging || slot.status === 'Booked') return;

    const newSelected = new Set<string>();
    
    if (dragStart) {
      const minDay = Math.min(dragStart.day, dayIndex);
      const maxDay = Math.max(dragStart.day, dayIndex);
      const minSlot = Math.min(dragStart.slot, slotIndex);
      const maxSlot = Math.max(dragStart.slot, slotIndex);

      for (let d = minDay; d <= maxDay; d++) {
        for (let s = minSlot; s <= maxSlot; s++) {
          // Check if slot is booked
          const dayAvail = availability[d];
          if (dayAvail && dayAvail.slots[s]?.status !== 'Booked') {
            newSelected.add(`${d}-${s}`);
          }
        }
      }
    }

    setSelectedSlots(newSelected);
  };

  const handleMouseUp = () => {
    if (isDragging && selectedSlots.size > 0) {
      const slots: { date: string; time: string }[] = [];
      
      selectedSlots.forEach((key) => {
        const [dayIndex, slotIndex] = key.split('-').map(Number);
        const day = availability[dayIndex];
        if (day) {
          const slot = day.slots[slotIndex];
          if (slot) {
            slots.push({ date: day.date, time: slot.time });
          }
        }
      });

      onSlotsSelected(slots);
    }

    setIsDragging(false);
    setDragStart(null);
    setSelectedSlots(new Set());
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, selectedSlots]);

  const getSlotClass = (slot: TimeSlot, dayIndex: number, slotIndex: number) => {
    const isSelected = selectedSlots.has(`${dayIndex}-${slotIndex}`);
    const baseClass = `time-slot ${slot.status.toLowerCase()}`;
    return isSelected ? `${baseClass} selecting` : baseClass;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6">
        <div className="grid grid-cols-8 gap-2">
          <div className="w-16" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="loading-shimmer h-4 w-12 mx-auto rounded mb-1" />
              <div className="loading-shimmer h-6 w-8 mx-auto rounded" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-8 gap-2">
          <div className="space-y-1">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="h-6" />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, d) => (
            <div key={d} className="space-y-1">
              {Array.from({ length: 48 }).map((_, s) => (
                <div key={s} className="loading-shimmer h-6 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-slate-800/50 rounded-2xl p-6 select-none ${isDragging ? 'paint-mode' : ''}`}
      ref={gridRef}
    >
      {/* Header row with day names */}
      <div className="grid grid-cols-8 gap-2 mb-4">
        <div className="w-16" /> {/* Spacer for time column */}
        {availability.map((day, i) => (
          <div key={day.date} className="text-center">
            <div className="text-slate-400 text-xs uppercase tracking-wider">
              {day.dayName}
            </div>
            <div className="text-white font-semibold text-lg">
              {format(parseISO(day.date), 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable grid area */}
      <div className="max-h-[600px] overflow-y-auto pr-2">
        <div className="grid grid-cols-8 gap-2">
          {/* Time labels column */}
          <div className="space-y-0">
            {timeLabels.map((label, i) => (
              <div
                key={i}
                className="h-6 flex items-center justify-end pr-2 text-xs text-slate-500"
              >
                {i % 2 === 0 ? label : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {availability.map((day, dayIndex) => (
            <div key={day.date} className="space-y-0">
              {day.slots.map((slot, slotIndex) => (
                <div
                  key={`${day.date}-${slot.time}`}
                  className={getSlotClass(slot, dayIndex, slotIndex)}
                  onMouseDown={() => handleMouseDown(dayIndex, slotIndex, slot)}
                  onMouseEnter={() => handleMouseEnter(dayIndex, slotIndex, slot)}
                  title={`${day.dayName} ${slot.time} - ${slot.status}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
