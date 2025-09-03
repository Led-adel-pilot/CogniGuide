"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  showTimeOnButton?: boolean;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  className,
  showTimeOnButton = true
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState<string>("08:00:00");
  const [isTimeInputFocused, setIsTimeInputFocused] = React.useState(false);

  // Initialize time value from existing date
  React.useEffect(() => {
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      setTimeValue(`${hours}:${minutes}:${seconds}`);
    }
  }, [date]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      onDateChange?.(undefined);
      return;
    }

    // Combine selected date with current time
    const [hours, minutes, seconds] = timeValue.split(':').map(Number);
    const dateWithTime = new Date(newDate);
    dateWithTime.setHours(hours, minutes, seconds);

    onDateChange?.(dateWithTime);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime);

    // Only update the date when not actively typing (to prevent premature submissions)
    if (!isTimeInputFocused && date) {
      const [hours, minutes, seconds] = newTime.split(':').map(Number);
      const updatedDate = new Date(date);
      updatedDate.setHours(hours, minutes, seconds);
      onDateChange?.(updatedDate);
    }
  };

  const handleClose = () => {
    // Commit any pending time changes when closing
    if (date) {
      const [hours, minutes, seconds] = timeValue.split(':').map(Number);
      const updatedDate = new Date(date);
      updatedDate.setHours(hours, minutes, seconds);
      onDateChange?.(updatedDate);
    }
    setIsOpen(false);
  };

  const formatDateTime = (date: Date) => {
    const dateStr = date.toLocaleDateString();
    if (!showTimeOnButton) {
      return dateStr;
    }
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? formatDateTime(date) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[120]" align="start" side="bottom" avoidCollisions={false}>
        <div className="rounded-md border">
          <Calendar
            mode="single"
            className="p-2"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="border-t p-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="time-input" className="text-xs">
                Enter time
              </Label>
              <div className="relative grow">
                <Input
                  id="time-input"
                  type="time"
                  step="1"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  onFocus={() => setIsTimeInputFocused(true)}
                  onBlur={() => {
                    setIsTimeInputFocused(false);
                    // Commit changes when focus leaves the input
                    if (date) {
                      const [hours, minutes, seconds] = timeValue.split(':').map(Number);
                      const updatedDate = new Date(date);
                      updatedDate.setHours(hours, minutes, seconds);
                      onDateChange?.(updatedDate);
                    }
                  }}
                  className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                  <ClockIcon size={16} aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}