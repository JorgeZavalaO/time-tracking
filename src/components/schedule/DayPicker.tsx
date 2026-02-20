'use client'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const DAYS = [
  { code: 'MON', label: 'Lu' },
  { code: 'TUE', label: 'Ma' },
  { code: 'WED', label: 'Mi' },
  { code: 'THU', label: 'Ju' },
  { code: 'FRI', label: 'Vi' },
  { code: 'SAT', label: 'Sa' },
  { code: 'SUN', label: 'Do' },
];

export function DayPicker(props: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      value={props.value}
      onValueChange={props.onChange}
      className="grid grid-cols-7 gap-1"
    >
      {DAYS.map(d => (
        <ToggleGroupItem
          key={d.code}
          value={d.code}
          className="h-8 px-0.5 text-xs"
        >
          {d.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
