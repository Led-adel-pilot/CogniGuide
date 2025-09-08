import { fsrs, generatorParameters, default_w, FSRS6_DEFAULT_DECAY } from 'ts-fsrs';

export type Grade = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export type FsrsScheduleState = {
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  scheduled_days: number;
  due: string; // ISO string
  last_review?: string; // ISO string
  state: number; // enum State, store as number for JSON portability
  examDate?: string; // ISO datetime string (YYYY-MM-DDTHH:mm:ss.sssZ) or date-only string (YYYY-MM-DD)
};

/**
 * Create a configured FSRS-6 scheduler instance.
 * We bias towards FSRS-6 by using its decay default, and leave weights as defaults.
 */
export function createFsrs() {
  const params = generatorParameters({
    // Keep request_retention default (0.9) and maximum_interval defaults; allow decay from FSRS6
  });
  // Override decay to FSRS-6 default through w -> computeDecayFactor internally
  // default_w is used by generatorParameters; relying on FSRS library's mapping for FSRS6
  const f = fsrs({ ...params, w: (default_w as unknown as number[]), /* ensure array copy */ });
  // Library determines decay/factor from w; expose constant for clarity
  void FSRS6_DEFAULT_DECAY;
  return f;
}

export function createInitialSchedule(now = new Date()): FsrsScheduleState {
  // Minimal, reasonable starting values as per FSRS card model
  return {
    difficulty: 5,
    stability: 0.1,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    scheduled_days: 0,
    due: now.toISOString(),
    last_review: undefined,
    state: 0,
  };
}

/**
 * Compute next FSRS state given a grade. If examDate is provided and hasn't passed yet,
 * we will adjust the next interval to ensure the next due does not overshoot the exam date.
 * If the exam date has passed, the constraint is ignored and normal FSRS scheduling applies.
 */
export function nextSchedule(
  current: FsrsScheduleState | null | undefined,
  grade: Grade,
  now = new Date(),
): FsrsScheduleState {
  const f = createFsrs();
  const cardInput = current
    ? {
        difficulty: current.difficulty,
        stability: current.stability,
        reps: current.reps,
        lapses: current.lapses,
        learning_steps: current.learning_steps,
        scheduled_days: current.scheduled_days,
        due: new Date(current.due),
        last_review: current.last_review ? new Date(current.last_review) : undefined,
        state: current.state as any,
      }
    : undefined;

  const result = f.next(cardInput as any, now, grade as any);
  const updated = result.card;
  let due = updated.due instanceof Date ? updated.due : new Date(updated.due);

  // If an exam date exists, apply special scheduling rules.
  // If exam date has passed by more than 24h, it's erased.
  // If within 24h of exam, cards become due immediately for cramming.
  let nextExamDate = current?.examDate;
  const examDate = current?.examDate;
  if (examDate) {
    let exam: Date;
    if (examDate.includes('T')) {
      // Full datetime string
      exam = new Date(examDate);
    } else {
      // Legacy date-only string, assume end of day
      exam = new Date(examDate + 'T23:59:59');
    }

    const twentyFourHoursAfterExam = new Date(exam.getTime() + 24 * 60 * 60 * 1000);

    if (now > twentyFourHoursAfterExam) {
      // More than 24 hours after the exam, clear the exam date for future scheduling
      nextExamDate = undefined;
    } else if (now >= exam) {
      // Within the 24-hour grace period, schedule for 'now' to make it due immediately for cramming
      due = now;
    } else if (due > exam) {
      // Exam date is in the future, and FSRS would overshoot it - clamp
      due = exam;
    }
  }

  return {
    difficulty: updated.difficulty,
    stability: updated.stability,
    reps: updated.reps,
    lapses: updated.lapses,
    learning_steps: updated.learning_steps,
    scheduled_days: updated.scheduled_days,
    due: due.toISOString(),
    last_review: now.toISOString(),
    state: updated.state as any,
    examDate: nextExamDate,
  };
}


