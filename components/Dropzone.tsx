'use client';

import posthog from 'posthog-js';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { UploadCloud, File, X } from 'lucide-react';

interface RadialProgressBarProps {
  progress?: number;
  size?: number;
  strokeWidth?: number;
}

function RadialProgressBar({ progress = 0, size = 48, strokeWidth = 5 }: RadialProgressBarProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 drop-shadow-sm"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted-foreground/25"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-muted-foreground transition-all duration-500 ease-out"
          style={{
            filter: 'drop-shadow(0 0 4px rgba(var(--primary), 0.3))'
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground transition-all duration-200">
          {Math.round(normalizedProgress)}
        </span>
      </div>
    </div>
  );
}

interface DropzoneProps {
  onFileChange: (files: File[]) => void;
  disabled?: boolean;
  // Return false to block opening the file dialog
  onOpen?: () => boolean | void;
  // Show loading state for pre-parsing
  isPreParsing?: boolean;
  // Upload progress percentage (0-100)
  uploadProgress?: number;
  // Optional whitelist of files to keep by name+size (used to prune overflow files)
  allowedNameSizes?: { name: string; size: number }[];
  // Visual size variant
  size?: 'default' | 'compact';
  // Callback when a file is removed (useful for resetting upload states)
  onFileRemove?: () => void;
}

export default function Dropzone({ onFileChange, disabled = false, onOpen, isPreParsing = false, uploadProgress, allowedNameSizes, size = 'default', onFileRemove }: DropzoneProps) {
  const [dragIsOver, setDragIsOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    onFileChange(files);
  }, [files, onFileChange]);

  // Prune files when an allowed list is provided
  useEffect(() => {
    if (!allowedNameSizes || allowedNameSizes.length === 0) return;
    setFiles(prev => {
      const allowedSet = new Set(allowedNameSizes.map(a => `${a.name}|${a.size}`));
      const next = prev.filter(f => allowedSet.has(`${f.name}|${f.size}`));
      return next;
    });
    // do not include allowedNameSizes in onFileChange deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedNameSizes?.length]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragIsOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIsOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setDragIsOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles);
      posthog.capture('files_added', {
        method: 'drag-and-drop',
        file_count: newFiles.length,
        file_types: newFiles.map(f => f.type),
        total_size_mb: newFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024),
      });
      setFiles(prevFiles => {
        const merged = [...prevFiles, ...newFiles];
        const seen = new Set<string>();
        // Deduplicate by name|size|lastModified
        return merged.filter(f => {
          const key = `${f.name}|${f.size}|${(f as any).lastModified ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    }
  }, [disabled]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const newFiles = Array.from(selectedFiles);
      posthog.capture('files_added', {
        method: 'file-selector',
        file_count: newFiles.length,
        file_types: newFiles.map(f => f.type),
        total_size_mb: newFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024),
      });
      setFiles(prevFiles => {
        const merged = [...prevFiles, ...newFiles];
        const seen = new Set<string>();
        return merged.filter(f => {
          const key = `${f.name}|${f.size}|${(f as any).lastModified ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    }
    // Reset the input value so selecting the same files again still fires onChange
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    // Force re-mount the input to avoid edge cases where shift-selection prevents subsequent change events
    setInputKey(prev => prev + 1);
  };
  
  const handleRemoveFile = (fileToRemove: File) => {
    posthog.capture('file_removed', {
      file_name: fileToRemove.name,
      file_type: fileToRemove.type,
      file_size_mb: fileToRemove.size / (1024 * 1024),
    });
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
    // Notify parent component to reset upload states
    onFileRemove?.();
  }

  const dropzoneClassName = useMemo(() => {
    const heightClass = size === 'compact' ? 'h-36 sm:h-40' : 'h-48';
    const base = `flex flex-col items-center justify-center w-full ${heightClass} border-2 border-dashed rounded-[1.25rem] cursor-pointer transition-colors duration-300`;
    if (disabled) return `${base} bg-muted/50 border-border/30 cursor-not-allowed`;
    if (dragIsOver) return `${base} bg-primary/10 border-primary`;
    return `${base} bg-background hover:bg-muted/50 border-border/50 hover:border-primary/50`;
  }, [dragIsOver, disabled, size]);

  return (
    <div className="w-full">
      <label
        htmlFor="dropzone-file"
        className={dropzoneClassName}
        onClick={(e) => {
          if (disabled) return;
          // Trigger early auth prompt hook when user attempts to open file dialog
          try {
            const proceed = onOpen ? onOpen() : true;
            if (proceed === false) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          } catch {}
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {files.length > 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-full p-4">
            <div className="flex flex-row items-center justify-center gap-4 w-full overflow-x-auto max-h-full">
              {files.map((file, index) => (
                <div key={index} className="relative flex-shrink-0 flex flex-col items-center justify-center text-center p-4 border bg-background rounded-[1.25rem]">
                  <File className="w-10 h-10 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground truncate w-28" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">({(file.size < 102400 ? (file.size / 1024).toFixed(2) + ' KB' : (file.size / (1024 * 1024)).toFixed(2) + ' MB')})</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFile(file);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 inline-flex items-center justify-center bg-white text-black border border-gray-300 rounded-full hover:bg-gray-50 focus:outline-none z-30"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {isPreParsing && (
                    <div className="absolute inset-4 bg-background/90 backdrop-blur-md rounded-[1rem] flex flex-col items-center justify-center z-10 transition-all duration-200">
                      <RadialProgressBar progress={uploadProgress ?? 0} />
                      <p className="text-xs text-muted-foreground font-medium mt-3 text-center">
                        {uploadProgress !== undefined && uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
             <p className="mt-4 text-xs text-muted-foreground">You can add more files.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
            <p className="mb-2 text-md text-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, TXT, MD, or Images (PNG, JPG, etc.)</p>
          </div>
        )}
        <input
          key={inputKey}
          ref={inputRef}
          id="dropzone-file"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.docx,.pptx,.txt,.md,.markdown,text/markdown,image/png,image/jpeg,image/webp,image/gif"
          disabled={disabled}
          multiple
        />
      </label>
    </div>
  );
}
