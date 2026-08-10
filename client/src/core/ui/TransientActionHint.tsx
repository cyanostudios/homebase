import { Lock, X, type LucideIcon } from 'lucide-react';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TransientActionHintAction = {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  /** Visual weight for the action control. Default: secondary. */
  variant?: 'primary' | 'ghost';
};

export type TransientActionHintPayload = {
  /** Short title / primary line. */
  message: string;
  /** Optional supporting copy under the message. */
  description?: string;
  /** Viewport coordinates (e.g. from click clientX/clientY). */
  x: number;
  y: number;
  icon?: LucideIcon;
  /** Optional action buttons (e.g. Unlock). */
  actions?: TransientActionHintAction[];
  /** Override auto-dismiss. Default: 2.6s without actions, 8s with actions. */
  durationMs?: number;
};

export type TransientActionHintState = TransientActionHintPayload & { key: string };

export type TransientActionHintHandle = {
  show: (payload: TransientActionHintPayload) => void;
  dismiss: () => void;
  hint: TransientActionHintState | null;
};

const DEFAULT_DURATION_MS = 2600;
const DEFAULT_DURATION_WITH_ACTIONS_MS = 8000;

/**
 * Ephemeral helper near a pointer event — not a modal/dialog.
 * Supports title, optional description, optional actions, and a top-right close control.
 */
export function TransientActionHint({
  hint,
  onDismiss,
  className,
}: {
  hint: TransientActionHintState | null;
  onDismiss: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const remainingRef = useRef(DEFAULT_DURATION_MS);
  const deadlineRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const armTimer = useCallback(
    (ms: number) => {
      clearTimer();
      remainingRef.current = ms;
      deadlineRef.current = Date.now() + ms;
      timerRef.current = window.setTimeout(() => {
        if (!pausedRef.current) {
          onDismiss();
        }
      }, ms);
    },
    [clearTimer, onDismiss],
  );

  useEffect(() => {
    if (!hint) {
      clearTimer();
      pausedRef.current = false;
      setActionPendingId(null);
      return;
    }
    const hasActions = Boolean(hint.actions?.length);
    const duration =
      hint.durationMs ?? (hasActions ? DEFAULT_DURATION_WITH_ACTIONS_MS : DEFAULT_DURATION_MS);
    pausedRef.current = false;
    armTimer(duration);
    return clearTimer;
  }, [hint, armTimer, clearTimer]);

  const pauseTimer = () => {
    if (pausedRef.current) {
      return;
    }
    pausedRef.current = true;
    if (deadlineRef.current !== null) {
      remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
    }
    clearTimer();
  };

  const resumeTimer = () => {
    if (!pausedRef.current) {
      return;
    }
    pausedRef.current = false;
    const fallback = hint?.actions?.length ? DEFAULT_DURATION_WITH_ACTIONS_MS : DEFAULT_DURATION_MS;
    armTimer(remainingRef.current || fallback);
  };

  if (!hint || typeof document === 'undefined') {
    return null;
  }

  const Icon = hint.icon ?? Lock;
  const hasActions = Boolean(hint.actions?.length);
  const left = Math.min(Math.max(hint.x, 12), window.innerWidth - 12);
  const top = Math.min(Math.max(hint.y, 12), window.innerHeight - 12);

  return createPortal(
    <div
      key={hint.key}
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed z-[200]"
      style={{
        left,
        top,
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocusCapture={pauseTimer}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resumeTimer();
        }
      }}
    >
      <div
        className={cn(
          'relative flex max-w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-lg border py-2.5 pl-3 pr-7 text-xs shadow-md backdrop-blur-sm',
          'border-border bg-background/95 text-foreground',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150',
          className,
        )}
      >
        <button
          type="button"
          className={cn(
            'absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-sm',
            'text-red-600 transition-opacity hover:text-red-700 dark:text-red-400 dark:hover:text-red-300',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400/50',
          )}
          aria-label={t('common.close')}
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>

        <div className="flex items-start gap-2">
          <Icon
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium leading-snug text-red-700 dark:text-red-400">
              {hint.message}
            </p>
            {hint.description ? (
              <p className="leading-snug text-muted-foreground">{hint.description}</p>
            ) : null}
          </div>
        </div>

        {hasActions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {hint.actions!.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={action.variant === 'ghost' ? 'ghost' : 'secondary'}
                className="h-7 px-2.5 text-[11px]"
                disabled={actionPendingId !== null}
                onClick={() => {
                  void (async () => {
                    setActionPendingId(action.id);
                    try {
                      await action.onClick();
                      onDismiss();
                    } finally {
                      setActionPendingId(null);
                    }
                  })();
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function useTransientActionHint(): TransientActionHintHandle {
  const reactId = useId();
  const [hint, setHint] = useState<TransientActionHintState | null>(null);

  const dismiss = useCallback(() => {
    setHint(null);
  }, []);

  const show = useCallback(
    (payload: TransientActionHintPayload) => {
      setHint({
        ...payload,
        key: `${reactId}-${Date.now()}`,
      });
    },
    [reactId],
  );

  return { show, dismiss, hint };
}
