/** Live exam window: open from admin start until duration_minutes elapse. */

export function getLiveWindow(mock) {
  if (!mock?.is_live) {
    return { isLive: false, open: true, remainingSeconds: null, starts_at: null, ends_at: null };
  }
  const durationMs = Math.max(1, Number(mock.duration_minutes) || 90) * 60 * 1000;
  const start = mock.starts_at || mock.created_at || new Date().toISOString();
  const startMs = new Date(start).getTime();
  const endMs = mock.ends_at ? new Date(mock.ends_at).getTime() : startMs + durationMs;
  const remainingSeconds = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
  return {
    isLive: true,
    open: remainingSeconds > 0,
    remainingSeconds,
    starts_at: new Date(startMs).toISOString(),
    ends_at: new Date(endMs).toISOString(),
  };
}

export function liveWindowSqlValues(isLive, durationMinutes) {
  const live = Boolean(isLive);
  if (!live) return { starts_at: null, ends_at: null };
  const mins = Math.max(1, Number(durationMinutes) || 90);
  const start = new Date();
  const end = new Date(start.getTime() + mins * 60 * 1000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export function attemptRemainingSeconds(mock, attempt) {
  const window = getLiveWindow(mock);
  const durationSec = Math.max(60, (Number(mock.duration_minutes) || 90) * 60);
  if (!attempt?.started_at) {
    return window.isLive ? window.remainingSeconds : durationSec;
  }
  const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  const personalLeft = Math.max(0, durationSec - elapsed);
  if (window.isLive) return Math.min(personalLeft, window.remainingSeconds);
  return personalLeft;
}

export function decorateMockForStudent(mock, attempt) {
  const window = getLiveWindow(mock);
  const attemptStatus = attempt?.status || null;
  const remaining = attemptRemainingSeconds(mock, attempt);
  const canContinue = attemptStatus === 'in_progress' && remaining > 0 && (!window.isLive || window.open);
  const alreadyUsed = Boolean(attempt) && !canContinue;
  const visible = !window.isLive || (window.open && !alreadyUsed) || canContinue;
  return {
    ...mock,
    window_open: window.open,
    window_ends_at: window.ends_at,
    remaining_seconds: remaining,
    attempt_status: attemptStatus,
    already_attempted: alreadyUsed,
    can_continue: canContinue,
    visible_to_student: visible,
  };
}
