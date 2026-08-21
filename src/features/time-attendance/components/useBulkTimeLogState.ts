import { useState, useMemo, useCallback } from 'react';
import { StaffMember, TimeAttendanceSettings } from '../../../types';
import { TimeLogEntry } from '../hooks/useTimeLogs';
import { getMinutesBetween } from '../utils';

interface RowState {
  checked: boolean;
  clockIn: string;
  clockOut: string;
  teaBreak: boolean;
  teaBreakStart: string;
  teaBreakEnd: string;
  lunchBreak: boolean;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  touched: boolean;
}

export function useBulkTimeLogState(staff: StaffMember[], settings: TimeAttendanceSettings) {
  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff]);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [defaultClockIn, setDefaultClockIn] = useState(settings.checkInTime);
  const [defaultClockOut, setDefaultClockOut] = useState(settings.checkOutTime);
  const [defaultTeaBreak, setDefaultTeaBreak] = useState(settings.teaBreakEnabledByDefault);
  const [defaultTeaBreakStart, setDefaultTeaBreakStart] = useState(settings.teaBreakStart);
  const [defaultTeaBreakEnd, setDefaultTeaBreakEnd] = useState(settings.teaBreakEnd);
  const [defaultLunchBreak, setDefaultLunchBreak] = useState(settings.lunchBreakEnabledByDefault);
  const [defaultLunchBreakStart, setDefaultLunchBreakStart] = useState(settings.lunchBreakStart);
  const [defaultLunchBreakEnd, setDefaultLunchBreakEnd] = useState(settings.lunchBreakEnd);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const defaultRow = useCallback((): RowState => ({
    checked: false, clockIn: defaultClockIn, clockOut: defaultClockOut,
    teaBreak: defaultTeaBreak, teaBreakStart: defaultTeaBreakStart, teaBreakEnd: defaultTeaBreakEnd,
    lunchBreak: defaultLunchBreak, lunchBreakStart: defaultLunchBreakStart, lunchBreakEnd: defaultLunchBreakEnd,
    touched: false
  }), [
    defaultClockIn, defaultClockOut,
    defaultTeaBreak, defaultTeaBreakStart, defaultTeaBreakEnd,
    defaultLunchBreak, defaultLunchBreakStart, defaultLunchBreakEnd
  ]);

  const getRow = useCallback((staffId: string): RowState => {
    return rows[staffId] || defaultRow();
  }, [rows, defaultRow]);

  const toggleChecked = useCallback((staffId: string) => {
    setRows(prev => {
      const existing = prev[staffId];
      return {
        ...prev,
        [staffId]: existing ? { ...existing, checked: !existing.checked } : { ...defaultRow(), checked: true }
      };
    });
  }, [defaultRow]);

  const setChecked = useCallback((staffId: string, checked: boolean) => {
    setRows(prev => {
      const existing = prev[staffId] || defaultRow();
      return { ...prev, [staffId]: { ...existing, checked } };
    });
  }, [defaultRow]);

  const setRowTime = useCallback((staffId: string, field: 'clockIn' | 'clockOut', value: string) => {
    setRows(prev => {
      const existing = prev[staffId] || defaultRow();
      return { ...prev, [staffId]: { ...existing, [field]: value, touched: true, checked: true } };
    });
  }, [defaultRow]);

  const setRowBreak = useCallback((staffId: string, field: 'teaBreak' | 'lunchBreak', value: boolean) => {
    setRows(prev => {
      const existing = prev[staffId] || defaultRow();
      return { ...prev, [staffId]: { ...existing, [field]: value, touched: true, checked: true } };
    });
  }, [defaultRow]);

  const setRowBreakTime = useCallback((
    staffId: string,
    field: 'teaBreakStart' | 'teaBreakEnd' | 'lunchBreakStart' | 'lunchBreakEnd',
    value: string
  ) => {
    setRows(prev => {
      const existing = prev[staffId] || defaultRow();
      return { ...prev, [staffId]: { ...existing, [field]: value, touched: true, checked: true } };
    });
  }, [defaultRow]);

  // Changing a default only re-fills rows the user hasn't individually edited yet.
  const applyDefaultClockIn = useCallback((value: string) => {
    setDefaultClockIn(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], clockIn: value };
      }
      return next;
    });
  }, []);

  const applyDefaultClockOut = useCallback((value: string) => {
    setDefaultClockOut(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], clockOut: value };
      }
      return next;
    });
  }, []);

  const applyDefaultTeaBreak = useCallback((value: boolean) => {
    setDefaultTeaBreak(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], teaBreak: value };
      }
      return next;
    });
  }, []);

  const applyDefaultTeaBreakStart = useCallback((value: string) => {
    setDefaultTeaBreakStart(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], teaBreakStart: value };
      }
      return next;
    });
  }, []);

  const applyDefaultTeaBreakEnd = useCallback((value: string) => {
    setDefaultTeaBreakEnd(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], teaBreakEnd: value };
      }
      return next;
    });
  }, []);

  const applyDefaultLunchBreak = useCallback((value: boolean) => {
    setDefaultLunchBreak(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], lunchBreak: value };
      }
      return next;
    });
  }, []);

  const applyDefaultLunchBreakStart = useCallback((value: string) => {
    setDefaultLunchBreakStart(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], lunchBreakStart: value };
      }
      return next;
    });
  }, []);

  const applyDefaultLunchBreakEnd = useCallback((value: string) => {
    setDefaultLunchBreakEnd(value);
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].touched) next[id] = { ...next[id], lunchBreakEnd: value };
      }
      return next;
    });
  }, []);

  const checkedCount = useMemo(
    () => activeStaff.filter(s => getRow(s.id).checked).length,
    [activeStaff, getRow]
  );

  const allChecked = activeStaff.length > 0 && checkedCount === activeStaff.length;

  const toggleSelectAll = useCallback(() => {
    setRows(prev => {
      const next = { ...prev };
      const shouldCheck = !allChecked;
      for (const s of activeStaff) {
        const existing = next[s.id] || defaultRow();
        next[s.id] = { ...existing, checked: shouldCheck };
      }
      return next;
    });
  }, [activeStaff, allChecked, defaultRow]);

  const buildEntries = useCallback((): TimeLogEntry[] => {
    return activeStaff
      .filter(s => getRow(s.id).checked)
      .map(s => {
        const row = getRow(s.id);
        const breakMinutes = (row.teaBreak ? getMinutesBetween(row.teaBreakStart, row.teaBreakEnd) : 0)
          + (row.lunchBreak ? getMinutesBetween(row.lunchBreakStart, row.lunchBreakEnd) : 0);
        return {
          staffId: s.id, date, clockIn: row.clockIn, clockOut: row.clockOut,
          teaBreak: row.teaBreak, teaBreakStart: row.teaBreakStart, teaBreakEnd: row.teaBreakEnd,
          lunchBreak: row.lunchBreak, lunchBreakStart: row.lunchBreakStart, lunchBreakEnd: row.lunchBreakEnd,
          breakMinutes
        };
      });
  }, [activeStaff, getRow, date]);

  return {
    activeStaff,
    date, setDate,
    defaultClockIn, applyDefaultClockIn,
    defaultClockOut, applyDefaultClockOut,
    defaultTeaBreak, applyDefaultTeaBreak,
    defaultTeaBreakStart, applyDefaultTeaBreakStart,
    defaultTeaBreakEnd, applyDefaultTeaBreakEnd,
    defaultLunchBreak, applyDefaultLunchBreak,
    defaultLunchBreakStart, applyDefaultLunchBreakStart,
    defaultLunchBreakEnd, applyDefaultLunchBreakEnd,
    getRow, toggleChecked, setChecked, setRowTime, setRowBreak, setRowBreakTime,
    checkedCount, allChecked, toggleSelectAll, buildEntries,
  };
}
