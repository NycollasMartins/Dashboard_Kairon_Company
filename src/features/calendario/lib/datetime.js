// Helpers de fuso: a UI trabalha no horário LOCAL do navegador (datetime-local),
// e persistimos sempre em UTC (timestamptz) via toISOString().

const pad = (n) => String(n).padStart(2, '0');

// Date -> "YYYY-MM-DDTHH:mm" (para <input type="datetime-local">)
export function toLocalDateTimeInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date -> "YYYY-MM-DD" (para <input type="date">)
export function toLocalDateInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DDTHH:mm" (local) -> ISO UTC
export function localDateTimeToISO(value) {
  return new Date(value).toISOString();
}

// "YYYY-MM-DD" (local) + hora -> ISO UTC
export function localDateToISO(dateValue, hour = 0, minute = 0) {
  const [y, m, d] = dateValue.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

// Formata um intervalo para exibição (pt-BR).
export function formatEventTime(event) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  if (event.all_day) {
    const sameDay = start.toDateString() === end.toDateString();
    return sameDay
      ? start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · Dia inteiro'
      : `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  }
  const sameDay = start.toDateString() === end.toDateString();
  const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${hhmm(start)} – ${hhmm(end)}`;
  }
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${hhmm(start)} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${hhmm(end)}`;
}
