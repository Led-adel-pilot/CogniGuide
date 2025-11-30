import { useState } from 'react';
import { BrainCircuit, FileText } from 'lucide-react';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import { cn } from '@/lib/utils';

export type WizardModeChoice = 'mindmap' | 'flashcards' | null;
export type WizardInputChoice = 'upload' | 'prompt' | null;
export type LearningGoalChoice = 'casual' | 'regular' | 'serious' | 'intense' | null;
export type WizardStage = 'mode' | 'goal' | 'input';

interface OnboardingWizardModalProps {
  open: boolean;
  stage: WizardStage;
  selectedMode: WizardModeChoice;
  selectedGoal: LearningGoalChoice;
  inputChoice: WizardInputChoice;
  customPrompt: string;
  suggestedTopics: string[];
  onBackToMode: () => void;
  onModeSelect: (mode: Exclude<WizardModeChoice, null>) => void;
  onGoalSelect: (goal: Exclude<LearningGoalChoice, null>) => void;
  onUploadChosen: () => void;
  onPromptPrefill: (prompt: string, isFullPrompt?: boolean) => void;
  onCustomPromptChange: (value: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function OnboardingWizardModal({
  open,
  stage,
  selectedMode,
  selectedGoal,
  inputChoice,
  customPrompt,
  suggestedTopics,
  onBackToMode,
  onModeSelect,
  onGoalSelect,
  onUploadChosen,
  onPromptPrefill,
  onCustomPromptChange,
  onSkip,
  onClose,
}: OnboardingWizardModalProps) {
  const [localSelectedMode, setLocalSelectedMode] = useState<WizardModeChoice>(null);
  const stageOrder: WizardStage[] = ['mode', 'goal', 'input'];
  const totalSteps = stageOrder.length + 1; // include generation step
  const currentStepIndex = Math.max(stageOrder.indexOf(stage), 0);
  const currentStepNumber = currentStepIndex + 1;
  const progressPercent = Math.round((currentStepNumber / totalSteps) * 100);

  const learningGoalOptions: Array<{
    value: Exclude<LearningGoalChoice, null>;
    duration: string;
    label: string;
  }> = [
    { value: 'casual', duration: '5 min / day', label: 'Casual' },
    { value: 'regular', duration: '10 min / day', label: 'Regular' },
    { value: 'serious', duration: '15 min / day', label: 'Serious' },
    { value: 'intense', duration: '20 min / day', label: 'Intense' },
  ];

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
              <span>Step {currentStepNumber} of {totalSteps}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 pt-8 pb-6 space-y-6">
          <div className="space-y-3 text-center">
            <h2 className={cn("font-bold text-foreground", stage === 'mode' ? "text-2xl" : "text-xl")}>
              {stage === 'mode'
                ? "What is your main goal today?"
                : stage === 'goal'
                  ? "What's your daily learning goal?"
                  : `Add something to study, Our AI will convert to ${selectedMode === 'flashcards' ? 'flashcards' : 'a Mind Map'}`}
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
          ) : stage === 'goal' ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {learningGoalOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onGoalSelect(option.value)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border px-5 py-3 text-left transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      selectedGoal === option.value ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-background'
                    )}
                  >
                    <span className="text-base font-semibold text-foreground">{option.duration}</span>
                    <span className="text-sm font-medium text-muted-foreground">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <Dropzone
                  onFileChange={(files) => {
                    if (!files.length) return;
                    const hasImage = files.some((file) => {
                      const lowerName = file.name.toLowerCase();
                      return file.type.startsWith('image/') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') || lowerName.endsWith('.gif');
                    });
                    const autoSubmit = !hasImage;
                    try {
                      if (typeof window !== 'undefined') {
                        const forward = (window as any).__cogniguide_onboarding_files as ((f: File[], options?: { autoSubmit?: boolean }) => void) | undefined;
                        if (typeof forward === 'function') {
                          forward(files, { autoSubmit });
                        } else {
                          window.dispatchEvent(
                            new CustomEvent('cogniguide:onboarding-files', {
                              detail: { files, autoSubmit },
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
                <p className="text-sm font-semibold text-foreground">Don&apos;t have a file? Just type what you want</p>
                <PromptForm
                  prompt={customPrompt}
                  setPrompt={onCustomPromptChange}
                  onSubmit={(text) => onPromptPrefill(text, true)}
                  isLoading={false}
                  disabled={false}
                  filesLength={0}
                  mode={(selectedMode as 'mindmap' | 'flashcards') || 'mindmap'}
                  ctaLabel="Generate"
                />
                <p className="text-sm font-semibold text-foreground pt-2">OR try one of these topics</p>
                <div className="flex w-full gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => {
                        const prefix = selectedMode === 'flashcards' ? 'Generate flashcards about' : 'Create a mind map about';
                        onCustomPromptChange(`${prefix} ${topic}`);
                      }}
                      className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 pill-soft-sky"
                    >
                      <span className="whitespace-nowrap">{topic}</span>
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
