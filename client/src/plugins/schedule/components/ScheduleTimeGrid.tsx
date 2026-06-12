import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, MapPin, Pencil, Plus } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SERIES_TEAM_ROW_STYLES, WEEK_DAYS } from '@/plugins/teams/types/teams';

import {
  computeDayLayout,
  getDropCellId,
  getGridEndMinutes,
  getGridHeightPx,
  getGridStartMinutes,
  getSlotDragId,
  getSlotDurationMinutes,
  getSlotHeightPx,
  getSlotTopPx,
  GRID_ROW_HEIGHT_PX,
  GRID_SLOT_MINUTES,
  minutesToTime,
  type ScheduleGridSettings,
  type ScheduleSlot,
  type SlotLayout,
} from '../types/schedule';
import type { ScheduleSlotHighlight } from '../hooks/useSchedulePendingChanges';

function getSlotClassName(
  slot: ScheduleSlot,
  isClickable: boolean,
  highlight: ScheduleSlotHighlight,
  isDragging?: boolean,
) {
  const colorStyles = slot.teamColor ? SERIES_TEAM_ROW_STYLES[slot.teamColor] : null;

  return cn(
    'group/slot absolute overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition-[border-color,box-shadow,background-color] duration-500',
    colorStyles ?? 'border-plugin-subtle/60 bg-background/95 text-foreground',
    highlight === 'pending' && 'border-orange-400 ring-2 ring-orange-400',
    highlight === 'saved' &&
      'border-green-500 ring-2 ring-green-500 bg-green-50/50 dark:bg-green-950/20',
    isDragging && 'opacity-60 ring-2 ring-primary/40',
    isClickable &&
      (colorStyles
        ? 'cursor-grab active:cursor-grabbing transition-[filter,box-shadow,border-color] hover:brightness-[0.98] hover:shadow-md dark:hover:brightness-110'
        : 'cursor-grab active:cursor-grabbing transition-colors hover:border-primary/40 hover:bg-primary/5'),
  );
}

function getColumnStyle(colIndex: number, colCount: number): React.CSSProperties {
  const widthPct = 100 / colCount;
  const leftPct = (colIndex / colCount) * 100;
  return {
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };
}

function ScheduleSlotContent({ slot, compact = false }: { slot: ScheduleSlot; compact?: boolean }) {
  const timeLabel = slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
  const label = slot.teamName || slot.title;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {!compact ? (
        <span className="truncate text-[10px] font-semibold leading-tight tabular-nums">
          {timeLabel}
        </span>
      ) : null}
      {label ? (
        <span
          className={cn(
            'truncate font-medium leading-tight',
            compact ? 'text-xs font-semibold' : 'text-[10px]',
          )}
        >
          {label}
        </span>
      ) : null}
      {slot.location && !compact ? (
        <span className="inline-flex max-w-full items-center gap-0.5 text-[9px] leading-tight opacity-75">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{slot.location}</span>
        </span>
      ) : null}
    </div>
  );
}

function DroppableCell({
  day,
  startMinutes,
  gridSettings,
  onAddSlot,
  suppressClickRef,
}: {
  day: string;
  startMinutes: number;
  gridSettings: ScheduleGridSettings;
  onAddSlot?: (day: string, startMinutes: number) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getDropCellId(day, startMinutes),
    data: { day, startMinutes },
  });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`${day} ${minutesToTime(startMinutes)}`}
      className={cn(
        'group/cell absolute left-0 right-0 border-b border-border/30 transition-colors',
        isOver && 'bg-primary/10',
        onAddSlot && 'cursor-pointer hover:bg-muted/40',
      )}
      style={{
        top:
          ((startMinutes - getGridStartMinutes(gridSettings)) / GRID_SLOT_MINUTES) *
          GRID_ROW_HEIGHT_PX,
        height: GRID_ROW_HEIGHT_PX,
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          return;
        }
        onAddSlot?.(day, startMinutes);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (suppressClickRef.current) {
            return;
          }
          onAddSlot?.(day, startMinutes);
        }
      }}
    >
      {onAddSlot ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/cell:opacity-30">
          <Plus className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
        </span>
      ) : null}
    </div>
  );
}

function DraggableSlot({
  layout,
  gridSettings,
  savingSlotId,
  getSlotHighlight,
  onSlotClick,
  onEditSlot,
}: {
  layout: SlotLayout;
  gridSettings: ScheduleGridSettings;
  savingSlotId: string | null;
  getSlotHighlight?: (slot: ScheduleSlot) => ScheduleSlotHighlight;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onEditSlot?: (slot: ScheduleSlot) => void;
}) {
  const { t } = useTranslation();
  const { slot, colIndex, colCount } = layout;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: getSlotDragId(slot),
    data: { slot },
  });

  const isClickable = Boolean(slot.teamId && onSlotClick);
  const isSaving = savingSlotId === getSlotDragId(slot);
  const highlight = getSlotHighlight?.(slot) ?? null;
  const style: React.CSSProperties = {
    top: getSlotTopPx(slot, gridSettings),
    height: Math.max(getSlotHeightPx(slot), GRID_ROW_HEIGHT_PX - 2),
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 30 : 10,
    ...getColumnStyle(colIndex, colCount),
  };

  const className = getSlotClassName(slot, isClickable, highlight, isDragging);

  if (!isClickable) {
    return (
      <div ref={setNodeRef} className={className} style={style}>
        <ScheduleSlotContent slot={slot} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, isSaving && 'pointer-events-none opacity-70')}
      {...listeners}
      {...attributes}
      onClick={(event) => {
        if (isDragging) {
          return;
        }
        event.stopPropagation();
        onSlotClick?.(slot);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSlotClick?.(slot);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${slot.teamName || slot.title}, ${slot.startTime}–${slot.endTime}`}
    >
      {onEditSlot ? (
        <button
          type="button"
          className="absolute right-0.5 top-0.5 z-20 hidden h-5 w-5 items-center justify-center rounded bg-background/90 text-foreground shadow-sm group-hover/slot:flex"
          aria-label={t('schedule.editSlot')}
          onClick={(event) => {
            event.stopPropagation();
            onEditSlot(slot);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
        </button>
      ) : null}
      {isSaving ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        </div>
      ) : null}
      <ScheduleSlotContent slot={slot} />
    </div>
  );
}

function DayColumn({
  day,
  slots,
  gridSettings,
  savingSlotId,
  getSlotHighlight,
  onSlotClick,
  onEditSlot,
  onAddSlot,
  suppressClickRef,
}: {
  day: string;
  slots: ScheduleSlot[];
  gridSettings: ScheduleGridSettings;
  savingSlotId: string | null;
  getSlotHighlight?: (slot: ScheduleSlot) => ScheduleSlotHighlight;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onEditSlot?: (slot: ScheduleSlot) => void;
  onAddSlot?: (day: string, startMinutes: number) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
}) {
  const dropCells = useMemo(() => {
    const cells: number[] = [];
    for (
      let minutes = getGridStartMinutes(gridSettings);
      minutes < getGridEndMinutes(gridSettings);
      minutes += GRID_SLOT_MINUTES
    ) {
      cells.push(minutes);
    }
    return cells;
  }, [gridSettings]);

  const dayLayouts = useMemo(() => {
    const daySlots = slots.filter((slot) => slot.day === day);
    return computeDayLayout(daySlots);
  }, [day, slots]);

  return (
    <div
      className="relative border-l border-border/50 bg-background/40"
      style={{ height: getGridHeightPx(gridSettings) }}
    >
      {dropCells.map((startMinutes) => (
        <DroppableCell
          key={`${day}-${startMinutes}`}
          day={day}
          startMinutes={startMinutes}
          gridSettings={gridSettings}
          onAddSlot={onAddSlot}
          suppressClickRef={suppressClickRef}
        />
      ))}
      {dayLayouts.map((layout) => (
        <DraggableSlot
          key={getSlotDragId(layout.slot)}
          layout={layout}
          gridSettings={gridSettings}
          savingSlotId={savingSlotId}
          getSlotHighlight={getSlotHighlight}
          onSlotClick={onSlotClick}
          onEditSlot={onEditSlot}
        />
      ))}
    </div>
  );
}

export function ScheduleTimeGrid({
  slots,
  gridSettings,
  savingSlotId,
  getSlotHighlight,
  onSlotClick,
  onEditSlot,
  onAddSlot,
  onSlotMove,
}: {
  slots: ScheduleSlot[];
  gridSettings: ScheduleGridSettings;
  savingSlotId: string | null;
  getSlotHighlight?: (slot: ScheduleSlot) => ScheduleSlotHighlight;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onEditSlot?: (slot: ScheduleSlot) => void;
  onAddSlot?: (day: string, startMinutes: number) => void;
  onSlotMove: (
    slot: ScheduleSlot,
    newDay: string,
    newStartTime: string,
    newEndTime: string,
  ) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null);
  const suppressCellClickRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const timeLabels = useMemo(() => {
    const labels: { minutes: number; label: string }[] = [];
    for (
      let minutes = getGridStartMinutes(gridSettings);
      minutes < getGridEndMinutes(gridSettings);
      minutes += GRID_SLOT_MINUTES
    ) {
      const showLabel = minutes % 60 === 0;
      labels.push({
        minutes,
        label: showLabel ? minutesToTime(minutes) : '',
      });
    }
    return labels;
  }, [gridSettings]);

  const handleDragStart = (event: DragStartEvent) => {
    const slot = event.active.data.current?.slot as ScheduleSlot | undefined;
    setActiveSlot(slot ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    suppressCellClickRef.current = true;
    window.setTimeout(() => {
      suppressCellClickRef.current = false;
    }, 0);
    setActiveSlot(null);
    const slot = event.active.data.current?.slot as ScheduleSlot | undefined;
    const dropData = event.over?.data.current as
      | { day?: string; startMinutes?: number }
      | undefined;

    if (!slot || !dropData?.day || dropData.startMinutes === undefined) {
      return;
    }

    const duration = getSlotDurationMinutes(slot);
    const newStartMinutes = dropData.startMinutes;
    const newEndMinutes = Math.min(newStartMinutes + duration, getGridEndMinutes(gridSettings));

    if (
      slot.day === dropData.day &&
      slot.startTime === minutesToTime(newStartMinutes) &&
      slot.endTime === minutesToTime(newEndMinutes)
    ) {
      return;
    }

    void onSlotMove(
      slot,
      dropData.day,
      minutesToTime(newStartMinutes),
      minutesToTime(newEndMinutes),
    );
  };

  const handleDragCancel = () => {
    setActiveSlot(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('schedule.dragHint')} {t('schedule.clickEmptyHint')}
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border/60 bg-muted/30">
              <div />
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="border-l border-border/50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {t(`teams.daysShort.${day}`)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
              <div
                className="relative bg-muted/20"
                style={{ height: getGridHeightPx(gridSettings) }}
              >
                {timeLabels.map(({ minutes, label }) => (
                  <div
                    key={minutes}
                    className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                    style={{
                      top:
                        ((minutes - getGridStartMinutes(gridSettings)) / GRID_SLOT_MINUTES) *
                          GRID_ROW_HEIGHT_PX +
                        GRID_ROW_HEIGHT_PX / 2,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {WEEK_DAYS.map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  slots={slots}
                  gridSettings={gridSettings}
                  savingSlotId={savingSlotId}
                  getSlotHighlight={getSlotHighlight}
                  onSlotClick={onSlotClick}
                  onEditSlot={onEditSlot}
                  onAddSlot={onAddSlot}
                  suppressClickRef={suppressCellClickRef}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeSlot ? (
            <div
              className={cn(
                getSlotClassName(activeSlot, false, null, true),
                'relative w-[8.5rem] cursor-grabbing shadow-lg',
              )}
              style={{ height: Math.max(getSlotHeightPx(activeSlot), GRID_ROW_HEIGHT_PX) }}
            >
              <ScheduleSlotContent slot={activeSlot} compact />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
