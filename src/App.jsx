import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const monthNames = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameMonth(date, currentMonth) {
  return (
    date.getFullYear() === currentMonth.getFullYear() &&
    date.getMonth() === currentMonth.getMonth()
  );
}

function getCalendarDays(currentMonth) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const days = [];

  for (let i = 0; i < startOffset; i++) {
    days.push(new Date(year, month, 1 - (startOffset - i)));
  }

  for (let day = 1; day <= totalDays; day++) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - (startOffset + totalDays) + 1));
  }

  return days;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily: "Inter, system-ui, Arial, sans-serif",
    color: "#0f172a",
  },
  layout: {
    maxWidth: "1300px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.9fr)",
    gap: "24px",
    alignItems: "start",
  },
  card: {
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    padding: "20px",
    minWidth: 0,
    overflow: "hidden",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  title: { fontSize: "30px", margin: 0 },
  subtitle: { color: "#64748b", marginBottom: "6px", fontSize: "14px" },
  buttonRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  button: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: "14px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "14px",
    flexShrink: 0,
  },
  primaryButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: "14px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "14px",
  },
  dangerButton: {
    border: "none",
    background: "#dc2626",
    color: "white",
    borderRadius: "14px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "14px",
    flexShrink: 0,
  },
  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "8px",
  },
  weekDay: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 0",
    minWidth: 0,
  },
  dayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "8px",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    boxSizing: "border-box",
    minWidth: 0,
  },
  label: {
    fontSize: "14px",
    marginBottom: "6px",
    display: "block",
    color: "#334155",
  },
  field: { marginBottom: "12px" },
  sideStack: { display: "grid", gap: "24px", minWidth: 0 },
  statBox: {
    background: "#f1f5f9",
    borderRadius: "18px",
    padding: "16px",
    minWidth: 0,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "start",
    gap: "12px",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "12px",
    marginBottom: "10px",
    minWidth: 0,
  },
  badge: {
    background: "#e2e8f0",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "12px",
    flexShrink: 0,
  },
  smallMuted: { color: "#64748b", fontSize: "14px" },
  actionRow: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  textBlock: {
    minWidth: 0,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  nameText: {
    fontWeight: 700,
    minWidth: 0,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.35,
  },
  dayChip: {
    fontSize: "12px",
    background: "#f1f5f9",
    padding: "4px 8px",
    borderRadius: "10px",
    marginBottom: "4px",
    color: "#334155",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.3,
  },
  loadingBox: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "16px",
    padding: "12px 14px",
    marginBottom: "16px",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "16px",
    padding: "12px 14px",
    marginBottom: "16px",
  },
};

function DayCard({ date, currentMonth, dayEntries, todayKey, onSelect }) {
  const dateKey = formatDateKey(date);
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isToday = dateKey === todayKey;

  return (
    <button
      onClick={() => onSelect(dateKey)}
      style={{
        minHeight: "110px",
        borderRadius: "18px",
        border: isCurrentMonth ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
        background: isCurrentMonth ? "#fff" : "#f1f5f9",
        color: isCurrentMonth ? "#0f172a" : "#94a3b8",
        padding: "10px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: isToday ? "0 0 0 2px #cbd5e1 inset" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <strong>{date.getDate()}</strong>
        {dayEntries.length > 0 && <span style={styles.badge}>{dayEntries.length}</span>}
      </div>

      <div>
        {dayEntries.slice(0, 3).map((entry) => (
          <div
            key={`${entry.id}-${dateKey}`}
            style={styles.dayChip}
            title={entry.name}
          >
            {entry.name}
          </div>
        ))}
        {dayEntries.length > 3 && (
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            + ще {dayEntries.length - 3}
          </div>
        )}
      </div>
    </button>
  );
}

export default function DayOffCalendarApp() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ name: "", date: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadEntries = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("day_off_entries")
      .select("id, name, date, created_at")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message || "Не вдалося завантажити дані");
      setEntries([]);
    } else {
      setEntries(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const entry of entries) {
      if (!map[entry.date]) {
        map[entry.date] = [];
      }
      map[entry.date].push(entry);
    }
    return map;
  }, [entries]);

  const selectedDayEntries = selectedDate ? eventsByDate[selectedDate] || [] : [];
  const todayKey = formatDateKey(new Date());

  const summary = useMemo(() => {
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();

    const people = new Set();
    let totalBookedDays = 0;

    entries.forEach((entry) => {
      const [year, month] = entry.date.split("-").map(Number);
      if (year === currentYear && month - 1 === currentMonthIndex) {
        totalBookedDays += 1;
        people.add(entry.name);
      }
    });

    return { peopleCount: people.size, totalBookedDays };
  }, [entries, currentMonth]);

  const handleAddEntry = async () => {
    if (!form.name.trim() || !form.date) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("day_off_entries").insert([
      {
        name: form.name.trim(),
        date: form.date,
      },
    ]);

    if (error) {
      setErrorMessage(error.message || "Не вдалося додати запис");
      setSaving(false);
      return;
    }

    setForm({ name: "", date: "" });
    await loadEntries();
    setSaving(false);
  };

  const handleDeleteEntry = async (id) => {
    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("day_off_entries").delete().eq("id", id);

    if (error) {
      setErrorMessage(error.message || "Не вдалося видалити запис");
      setSaving(false);
      return;
    }

    if (editingId === id) {
      setEditingId(null);
      setEditingName("");
    }

    await loadEntries();
    setSaving(false);
  };

  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
  };

  const handleSaveEdit = async (id) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("day_off_entries")
      .update({ name: trimmedName })
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message || "Не вдалося оновити запис");
      setSaving(false);
      return;
    }

    setEditingId(null);
    setEditingName("");
    await loadEntries();
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm("Видалити всі записи з бази даних?");
    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("day_off_entries")
      .delete()
      .not("id", "is", null);

    if (error) {
      setErrorMessage(error.message || "Не вдалося очистити записи");
      setSaving(false);
      return;
    }

    setSelectedDate(null);
    setEditingId(null);
    setEditingName("");
    await loadEntries();
    setSaving(false);
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 960;

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.layout,
          gridTemplateColumns: isMobile ? "1fr" : styles.layout.gridTemplateColumns,
        }}
      >
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <div style={styles.subtitle}>Календар day off · Supabase sync</div>
              <h1 style={styles.title}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h1>
            </div>

            <div style={styles.buttonRow}>
              <button
                style={styles.button}
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                  )
                }
              >
                ← Назад
              </button>
              <button
                style={styles.button}
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                  )
                }
              >
                Вперед →
              </button>
              <button style={styles.dangerButton} onClick={handleDeleteAll} disabled={saving}>
                Очистити все
              </button>
            </div>
          </div>

          {loading && <div style={styles.loadingBox}>Завантаження даних із Supabase...</div>}
          {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.label}>Ім’я</label>
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Наприклад, Марина Шевченко"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Дата</label>
              <input
                style={styles.input}
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <button style={styles.primaryButton} onClick={handleAddEntry} disabled={saving}>
              {saving ? "Збереження..." : "Додати day off"}
            </button>
          </div>

          <div style={{ height: "16px" }} />

          <div style={styles.weekGrid}>
            {weekDays.map((day) => (
              <div key={day} style={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>

          <div style={styles.dayGrid}>
            {calendarDays.map((date) => {
              const dateKey = formatDateKey(date);
              const dayEntries = eventsByDate[dateKey] || [];

              return (
                <DayCard
                  key={dateKey}
                  date={date}
                  currentMonth={currentMonth}
                  dayEntries={dayEntries}
                  todayKey={todayKey}
                  onSelect={setSelectedDate}
                />
              );
            })}
          </div>
        </div>

        <div style={styles.sideStack}>
          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Огляд місяця</h2>
            <div style={styles.statBox}>
              <div style={styles.smallMuted}>Людей із day off цього місяця</div>
              <div style={{ fontSize: "32px", fontWeight: 700 }}>{summary.peopleCount}</div>
            </div>
            <div style={{ height: "12px" }} />
            <div style={styles.statBox}>
              <div style={styles.smallMuted}>Заброньовано day off днів</div>
              <div style={{ fontSize: "32px", fontWeight: 700 }}>
                {summary.totalBookedDays}
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>
              {selectedDate ? `Записи на ${selectedDate}` : "Вибери день"}
            </h2>

            {selectedDate ? (
              selectedDayEntries.length > 0 ? (
                selectedDayEntries.map((entry) => (
                  <div key={entry.id} style={styles.itemRow}>
                    <div style={styles.textBlock}>
                      {editingId === entry.id ? (
                        <>
                          <input
                            style={styles.input}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Нове ім'я"
                          />
                          <div style={{ ...styles.smallMuted, marginTop: "8px" }}>{entry.date}</div>
                        </>
                      ) : (
                        <>
                          <div style={styles.nameText} title={entry.name}>{entry.name}</div>
                          <div style={styles.smallMuted}>{entry.date}</div>
                        </>
                      )}
                    </div>
                    <div style={styles.actionRow}>
                      {editingId === entry.id ? (
                        <>
                          <button style={styles.button} onClick={() => handleSaveEdit(entry.id)} disabled={saving}>
                            Зберегти
                          </button>
                          <button style={styles.button} onClick={handleCancelEdit} disabled={saving}>
                            Скасувати
                          </button>
                        </>
                      ) : (
                        <button style={styles.button} onClick={() => handleStartEdit(entry)} disabled={saving}>
                          Редагувати
                        </button>
                      )}
                      <button style={styles.button} onClick={() => handleDeleteEntry(entry.id)} disabled={saving}>
                        Видалити
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.statBox}>На цей день ніхто не взяв day off.</div>
              )
            ) : (
              <div style={styles.statBox}>Клікни на дату в календарі, щоб побачити записи.</div>
            )}
          </div>

          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Усі записи</h2>
            <div style={{ ...styles.smallMuted, marginBottom: "12px" }}>
              Дані зберігаються в Supabase і будуть однаковими на всіх твоїх пристроях.
            </div>

            {entries
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((entry) => (
                <div key={entry.id} style={styles.itemRow}>
                  <div style={styles.textBlock}>
                    {editingId === entry.id ? (
                      <>
                        <input
                          style={styles.input}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Нове ім'я"
                        />
                        <div style={{ ...styles.smallMuted, marginTop: "8px" }}>{entry.date}</div>
                      </>
                    ) : (
                      <>
                        <div style={styles.nameText} title={entry.name}>{entry.name}</div>
                        <div style={styles.smallMuted}>{entry.date}</div>
                      </>
                    )}
                  </div>
                  <div style={styles.actionRow}>
                    {editingId === entry.id ? (
                      <>
                        <button style={styles.button} onClick={() => handleSaveEdit(entry.id)} disabled={saving}>
                          Зберегти
                        </button>
                        <button style={styles.button} onClick={handleCancelEdit} disabled={saving}>
                          Скасувати
                        </button>
                      </>
                    ) : (
                      <button style={styles.button} onClick={() => handleStartEdit(entry)} disabled={saving}>
                        Редагувати
                      </button>
                    )}
                    <button style={styles.button} onClick={() => handleDeleteEntry(entry.id)} disabled={saving}>
                      Видалити
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
