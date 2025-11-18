'use client';

import posthog from 'posthog-js';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { UploadCloud, File, X, FileText, Image as ImageIcon, FileCode, FileSpreadsheet, Music, Video } from 'lucide-react';

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
  onFileRemove?: (file: File) => void;
}

export default function Dropzone({ onFileChange, disabled = false, onOpen, isPreParsing = false, uploadProgress, allowedNameSizes, size = 'default', onFileRemove }: DropzoneProps) {
  const [dragIsOver, setDragIsOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploadingFileKeys, setUploadingFileKeys] = useState<Set<string>>(new Set());
  const [currentBatchProgress, setCurrentBatchProgress] = useState(0);

  const getFileKey = useCallback((file: File) => `${file.name}|${file.size}|${file.lastModified ?? ''}`, []);

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
        const prevKeys = new Set(prevFiles.map(getFileKey));
        const merged = [...prevFiles, ...newFiles];
        const seen = new Set<string>();
        const next: File[] = [];
        const newKeys: string[] = [];
        // Deduplicate by name|size|lastModified
        merged.forEach((f) => {
          const key = getFileKey(f);
          if (seen.has(key)) return;
          seen.add(key);
          next.push(f);
          if (!prevKeys.has(key)) {
            newKeys.push(key);
          }
        });
        if (newKeys.length > 0) {
          if (!isPreParsing) {
            setCurrentBatchProgress(0);
          }
          setUploadingFileKeys(prev => {
            const nextSet = new Set(prev);
            newKeys.forEach(k => nextSet.add(k));
            return nextSet;
          });
        }
        return next;
      });
    }
  }, [disabled, getFileKey, isPreParsing]);

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
        const prevKeys = new Set(prevFiles.map(getFileKey));
        const merged = [...prevFiles, ...newFiles];
        const seen = new Set<string>();
        const next: File[] = [];
        const newKeys: string[] = [];
        merged.forEach((f) => {
          const key = getFileKey(f);
          if (seen.has(key)) return;
          seen.add(key);
          next.push(f);
          if (!prevKeys.has(key)) {
            newKeys.push(key);
          }
        });
        if (newKeys.length > 0) {
          if (!isPreParsing) {
            setCurrentBatchProgress(0);
          }
          setUploadingFileKeys(prev => {
            const nextSet = new Set(prev);
            newKeys.forEach(k => nextSet.add(k));
            return nextSet;
          });
        }
        return next;
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
    setUploadingFileKeys(prev => {
      const next = new Set(prev);
      next.delete(getFileKey(fileToRemove));
      return next;
    });
    // Notify parent component to reset upload states
    onFileRemove?.(fileToRemove);
  }

  useEffect(() => {
    if (isPreParsing) {
      if (typeof uploadProgress === 'number') {
        setCurrentBatchProgress(uploadProgress);
      } else {
        setCurrentBatchProgress(prev => (prev < 100 ? prev : 100));
      }
    }
  }, [isPreParsing, uploadProgress]);

  useEffect(() => {
    if (!isPreParsing) {
      setUploadingFileKeys(new Set());
      setCurrentBatchProgress(0);
    }
  }, [isPreParsing]);

  const dropzoneClassName = useMemo(() => {
    const heightClass = size === 'compact' ? 'min-h-[9rem]' : 'min-h-[12rem]';
    const base = `relative flex flex-col items-center justify-center w-full ${heightClass} border-2 border-dashed rounded-[1.25rem] cursor-pointer transition-all duration-300 ease-in-out`;

    if (disabled) return `${base} bg-muted/30 border-border/30 cursor-not-allowed opacity-60`;
    if (dragIsOver) return `${base} bg-primary/5 border-primary scale-[1.01] ring-1 ring-primary/20`;
    return `${base} bg-background/50 hover:bg-muted/30 border-border/50 hover:border-primary/40`;
  }, [dragIsOver, disabled, size]);

  const isCentered = files.length <= 2;
  const gridClass = isCentered
    ? "flex flex-wrap justify-center gap-4 w-full"
    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full";
  const itemClass = isCentered
    ? "w-full sm:w-[calc(50%_-_1rem)] md:w-[calc(33.333%_-_1rem)] lg:w-[calc(25%_-_1rem)] flex-none"
    : "";

  const getFileIcon = (file: File) => {
    const type = file.type;
    const name = file.name.toLowerCase();

    const iconProps = { className: "w-8 h-8" };

    if (type.includes('pdf')) {
      return (
        <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
          <FileText {...iconProps} />
        </div>
      );
    }
    if (type.includes('image')) {
      return (
        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
          <ImageIcon {...iconProps} />
        </div>
      );
    }
    if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return (
        <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
          <FileSpreadsheet {...iconProps} />
        </div>
      );
    }
    if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.json') || name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx')) {
      return (
        <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-600">
          <FileCode {...iconProps} />
        </div>
      );
    }
    if (type.includes('video')) {
      return (
        <div className="p-3 rounded-xl bg-pink-500/10 text-pink-500">
          <Video {...iconProps} />
        </div>
      );
    }
    if (type.includes('audio')) {
      return (
        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
          <Music {...iconProps} />
        </div>
      );
    }

    return (
      <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
        <File {...iconProps} />
      </div>
    );
  };

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
          } catch { }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {files.length > 0 ? (
          <div className="w-full h-full p-6">
            <div className={gridClass}>
              {files.map((file, index) => {
                const fileKey = getFileKey(file);
                const showProgress = isPreParsing && uploadingFileKeys.has(fileKey);
                const displayProgress = Math.min(Math.max(currentBatchProgress, 0), 100);
                const isUploading = typeof uploadProgress === 'number'
                  ? uploadProgress < 100
                  : displayProgress < 100;

                return (
                  <div
                    key={index}
                    className={`group relative flex flex-col items-center justify-center text-center p-4 border border-border/40 bg-background/80 hover:bg-background hover:border-primary/30 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden ${itemClass}`}
                    onClick={(e) => e.stopPropagation()} // Prevent opening file dialog when clicking the card
                  >
                    <div className="mb-3 transition-transform duration-300 group-hover:scale-110">
                      {getFileIcon(file)}
                    </div>

                    <div className="w-full px-2">
                      <p className="text-sm font-medium text-foreground truncate w-full" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium">
                        {(file.size < 102400 ? (file.size / 1024).toFixed(1) + ' KB' : (file.size / (1024 * 1024)).toFixed(1) + ' MB')}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveFile(file);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0"
                      aria-label="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {showProgress && (
                      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <RadialProgressBar progress={displayProgress} size={40} strokeWidth={4} />
                        <p className="text-[10px] font-medium text-primary mt-2 animate-pulse">
                          {isUploading ? 'UPLOADING' : 'PROCESSING'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add more button card */}
              <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-border/40 hover:border-primary/40 bg-muted/5 hover:bg-muted/20 rounded-2xl transition-all duration-300 cursor-pointer group min-h-[140px] ${itemClass}`}>
                <div className="p-3 rounded-full bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300 mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Add more files</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="p-4 rounded-full bg-primary/5 text-primary ring-8 ring-primary/5 mb-2 transition-transform duration-300 hover:scale-105">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-foreground">
                Drop files here or <span className="text-primary cursor-pointer hover:underline">browse</span>
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Support for PDF, DOCX, Images, and Markdown
              </p>
            </div>
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
