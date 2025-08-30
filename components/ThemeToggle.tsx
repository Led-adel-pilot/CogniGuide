'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read current theme from localStorage
    try {
      const savedTheme = localStorage.getItem('cogniguide_theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    } catch (e) {}
  }, []);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
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
    } catch (e) {}
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

  if (!mounted) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Theme</div>
      <div className="flex gap-2">
        <button
          onClick={() => updateTheme('light')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted/50 border-border'
          }`}
        >
          <Sun className="h-4 w-4" />
          <span className="text-sm">Light</span>
        </button>
        <button
          onClick={() => updateTheme('dark')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted/50 border-border'
          }`}
        >
          <Moon className="h-4 w-4" />
          <span className="text-sm">Dark</span>
        </button>
        <button
          onClick={() => updateTheme('system')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted/50 border-border'
          }`}
        >
          <Monitor className="h-4 w-4" />
          <span className="text-sm">System</span>
        </button>
      </div>
    </div>
  );
}
