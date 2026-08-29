import { useEffect, useMemo, useState } from 'react';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import '@schedule-x/theme-default/dist/index.css';
import {
  isoToSx,
  isoToSxDate,
  sxToIso,
  type Appointment,
} from '../lib/appointments';
import './appointments.css';

/** Statuses that belong on the calendar grid. */
const ON_GRID = new Set(['requested', 'confirmed', 'completed']);

const CALENDARS = {
  requested: {
    colorName: 'requested',
    lightColors: { main: '#B26B00', container: '#FFF1D6', onContainer: '#5A3600' },
  },
  confirmed: {
    colorName: 'confirmed',
    lightColors: { main: '#0B7A70', container: '#D7F1EC', onContainer: '#05352F' },
  },
  completed: {
    colorName: 'completed',
    lightColors: { main: '#2C7FF2', container: '#DCEAFF', onContainer: '#0B356F' },
  },
};

function toEvent(a: Appointment, myId: string) {
  const other = a.doctorId === myId ? a.patientName : a.doctorName;
  return {
    id: a.id,
    title: other ? `${a.title} · ${other}` : a.title,
    start: isoToSx(a.start),
    end: isoToSx(a.end),
    calendarId: a.status === 'confirmed' || a.status === 'completed' ? a.status : 'requested',
    description: a.reason || '',
    location: a.mode === 'video' ? 'Video visit' : a.location || 'In-person',
  };
}

export function AppointmentsCalendar({
  appointments,
  myId,
  editable = false,
  onSelectEvent,
  onSelectSlot,
  onReschedule,
}: {
  appointments: Appointment[];
  myId: string;
  editable?: boolean;
  onSelectEvent?: (appt: Appointment) => void;
  onSelectSlot?: (startIso: string, endIso: string) => void;
  onReschedule?: (id: string, startIso: string, endIso: string) => void;
}) {
  const [eventsService] = useState(() => createEventsServicePlugin());
  const [dragAndDrop] = useState(() => createDragAndDropPlugin(15));

  const gridEvents = useMemo(
    () => appointments.filter((a) => ON_GRID.has(a.status)).map((a) => toEvent(a, myId)),
    [appointments, myId],
  );

  // Look up the full appointment behind a Schedule-X event id.
  const byId = useMemo(() => {
    const m = new Map<string, Appointment>();
    appointments.forEach((a) => m.set(a.id, a));
    return m;
  }, [appointments]);

  const calendar = useNextCalendarApp({
    views: [createViewWeek(), createViewDay(), createViewMonthGrid(), createViewMonthAgenda()],
    defaultView: 'week',
    selectedDate: isoToSxDate(new Date().toISOString()),
    dayBoundaries: { start: '08:00', end: '19:00' },
    weekOptions: { gridHeight: 480 },
    monthGridOptions: { nEventsPerDay: 3 },
    calendars: CALENDARS,
    events: gridEvents,
    plugins: editable ? [eventsService, dragAndDrop] : [eventsService],
    callbacks: {
      onEventClick(event) {
        const appt = byId.get(String(event.id));
        if (appt) onSelectEvent?.(appt);
      },
      onClickDateTime(dateTime) {
        if (!editable) return;
        const startIso = sxToIso(dateTime);
        const endIso = new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
        onSelectSlot?.(startIso, endIso);
      },
      onEventUpdate(event) {
        if (!editable) return;
        onReschedule?.(String(event.id), sxToIso(String(event.start)), sxToIso(String(event.end)));
      },
    },
  });

  // Push subsequent data changes through the events service (the config above
  // is only read once by useNextCalendarApp).
  useEffect(() => {
    eventsService.set(gridEvents);
  }, [eventsService, gridEvents]);

  return (
    <div className="ax-cal">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
