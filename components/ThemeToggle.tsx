'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

const themeOptions = [
  { value: 'light' as Theme, label: 'Light', icon: Sun },
  { value: 'dark' as Theme, label: 'Dark', icon: Moon },
  { value: 'system' as Theme, label: 'System', icon: Monitor },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read current theme from localStorage
    try {
      const savedTheme = localStorage.getItem('cogniguide_theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    } catch (e) { }
  }, []);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
    try {
      localStorage.setItem('cogniguide_theme', newTheme);

      // Update document theme immediately
      if (newTheme === 'light') {
        document.documentElement.dataset.theme = 'light';
      } else if (newTheme === 'dark') {
        document.documentElement.dataset.theme = 'dark';
      } else {
        // system
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      }
    } catch (e) { }
  };

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        document.documentElement.dataset.theme = mediaQuery.matches ? 'dark' : 'light';
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  if (!mounted) return null;

  const currentThemeOption = themeOptions.find(option => option.value === theme);
  const CurrentIcon = currentThemeOption?.icon || Monitor;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-foreground/80 pl-2">Theme</div>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors min-w-[120px]"
        >
          <div className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{currentThemeOption?.label || 'System'}</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1 bg-background border rounded-xl shadow-lg z-10 overflow-hidden min-w-[120px]">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTheme(option.value);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${isSelected
                    ? 'bg-muted/60'
                    : 'hover:bg-muted/50 text-foreground'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
