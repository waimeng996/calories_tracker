'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DateStripProps {
  dateKeys: string[]; // ascending, oldest first
  selectedDate: string;
}

// getUTCDay()-indexed (0 = Sunday), unlike the old Monday-first WEEKDAY_LABELS in page.tsx.
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export default function DateStrip({ dateKeys, selectedDate }: DateStripProps) {
  const router = useRouter();
  const selectedRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, [selectedDate]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-2 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {dateKeys.map((dateKey) => {
          const isSelected = dateKey === selectedDate;
          const weekday = WEEKDAY_LABELS[new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()];
          return (
            <Link
              key={dateKey}
              ref={isSelected ? selectedRef : undefined}
              href={`/?date=${dateKey}`}
              className="flex flex-shrink-0 flex-col items-center gap-1"
            >
              <span className="text-xs text-gray-400">{weekday}</span>
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-sm"
                style={
                  isSelected
                    ? { background: '#7F77DD', color: '#fff', fontWeight: 500, border: '2px solid #26215C' }
                    : { background: '#CECBF6', color: '#26215C' }
                }
              >
                {Number(dateKey.slice(8, 10))}
              </span>
            </Link>
          );
        })}
      </div>
      <label
        aria-label="拣日期"
        className="relative flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: '#CECBF6', color: '#26215C' }}
      >
        📅
        <input
          type="date"
          value={selectedDate}
          max={dateKeys[dateKeys.length - 1]}
          onChange={(e) => e.target.value && router.push(`/?date=${e.target.value}`)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
