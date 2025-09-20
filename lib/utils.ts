import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get user's locale for proper date formatting
export function getUserLocale(): string {
  // Try to get from browser's navigator, fallback to 'en-US'
  if (typeof window !== 'undefined' && navigator?.language) {
    return navigator.language;
  }
  return 'en-US';
}

// Format date using user's locale
export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = getUserLocale();
  return date.toLocaleDateString(locale, options);
}

// Format time using user's locale
export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = getUserLocale();
  return date.toLocaleTimeString(locale, options);
}

// Format date and time using user's locale
export function formatDateTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = getUserLocale();
  return date.toLocaleString(locale, options);
}
