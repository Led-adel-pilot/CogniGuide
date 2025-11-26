import { useState } from 'react';
import { BrainCircuit, FileText, Sparkles } from 'lucide-react';
import Dropzone from '@/components/Dropzone';
import { cn } from '@/lib/utils';

export type WizardModeChoice = 'mindmap' | 'flashcards' | null;
export type WizardInputChoice = 'upload' | 'prompt' | null;
export type WizardStage = 'mode' | 'input';

interface OnboardingWizardModalProps {
  open: boolean;
  stage: WizardStage;
  selectedMode: WizardModeChoice;
  inputChoice: WizardInputChoice;
  customPrompt: string;
  suggestedTopics: string[];
  onBackToMode: () => void;
  onModeSelect: (mode: Exclude<WizardModeChoice, null>) => void;
  onUploadChosen: () => void;
  onPromptPrefill: (prompt: string) => void;
  onCustomPromptChange: (value: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function OnboardingWizardModal({
  open,
  stage,
  selectedMode,
  inputChoice,
  customPrompt,
  suggestedTopics,
  onBackToMode,
  onModeSelect,
  onUploadChosen,
  onPromptPrefill,
  onCustomPromptChange,
  onSkip,
  onClose,
}: OnboardingWizardModalProps) {
  const [localSelectedMode, setLocalSelectedMode] = useState<WizardModeChoice>(null);

  const handleModeClick = (mode: Exclude<WizardModeChoice, null>) => {
    setLocalSelectedMode(mode);
    onModeSelect(mode);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/60 backdrop-blur-md px-4">
      <div className="relative w-full max-w-2xl rounded-3xl border border-border/60 bg-background shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-3">
          <span aria-hidden />
        </div>
        <div className="px-6 mt-1 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span>Step {stage === 'mode' ? 1 : 2} of 3</span>
              <span>{stage === 'mode' ? '33%' : '66%'}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: stage === 'mode' ? '33%' : '66%' }}
              />
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 pt-8 pb-10 space-y-6">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {stage === 'mode' ? "What is your main goal today?" : "Add something to study"}
            </h2>
          </div>

          {stage === 'mode' ? (
            <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 items-stretch justify-items-stretch">
              <button
                type="button"
                onClick={() => handleModeClick('mindmap')}
                className={cn(
                  'flex h-full flex-col gap-3 rounded-2xl border p-4 text-left transition hover:border-primary hover:shadow-sm',
                  localSelectedMode === 'mindmap' ? 'border-primary bg-primary/5' : 'border-border/60 bg-background'
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Create a Mind Map
                </div>
                <p className="text-sm text-muted-foreground">
                  Understand complex topics with mind maps.
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleModeClick('flashcards')}
                className={cn(
                  'flex h-full flex-col gap-3 rounded-2xl border p-4 text-left transition hover:border-primary hover:shadow-sm',
                  localSelectedMode === 'flashcards' ? 'border-primary bg-primary/5' : 'border-border/60 bg-background'
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  Create Flashcards
                </div>
                <p className="text-sm text-muted-foreground">
                  Memorize & revise with flashcards and spaced-repetition.
                </p>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <Dropzone
                  onFileChange={(files) => {
                    if (!files.length) return;
                    try {
                      if (typeof window !== 'undefined') {
                        const forward = (window as any).__cogniguide_onboarding_files as ((f: File[], options?: { autoSubmit?: boolean }) => void) | undefined;
                        if (typeof forward === 'function') {
                          forward(files, { autoSubmit: true });
                        } else {
                          window.dispatchEvent(
                            new CustomEvent('cogniguide:onboarding-files', {
                              detail: { files, autoSubmit: true },
                              bubbles: true,
                            })
                          );
                        }
                      }
                    } catch { }
                    onUploadChosen();
                  }}
                  size="compact"
                  inputId="onboarding-dropzone"
                />
              </div>

              <div className="space-y-3 text-left">
                <p className="text-sm font-semibold text-foreground">Don&apos;t have a file? Try one of these topics</p>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 justify-items-stretch">
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => onPromptPrefill(topic)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 pill-soft-sky"
                    >
                      <span className="truncate">{topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
