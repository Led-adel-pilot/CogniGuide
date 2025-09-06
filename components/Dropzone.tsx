'use client';

import posthog from 'posthog-js';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { UploadCloud, File, X } from 'lucide-react';

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
}

export default function Dropzone({ onFileChange, disabled = false, onOpen, isPreParsing = false, uploadProgress, allowedNameSizes, size = 'default' }: DropzoneProps) {
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
        total_size_kb: newFiles.reduce((sum, f) => sum + f.size, 0) / 1024,
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
        total_size_kb: newFiles.reduce((sum, f) => sum + f.size, 0) / 1024,
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
      file_size_kb: fileToRemove.size / 1024,
    });
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
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
                  <p className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(2)} KB)</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFile(file);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none z-10"
                    aria-label="Remove file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {isPreParsing && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-[1.25rem] flex flex-col items-center justify-center z-20">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2"></div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Uploading{uploadProgress !== undefined ? ` (${uploadProgress}%)` : '...'}
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
