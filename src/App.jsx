import { useEffect, useMemo, useState } from "react";
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

function getInitials(fullName) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function DayCard({ date, currentMonth, dayEntries, todayKey, onSelect }) {
  const dateKey = formatDateKey(date);
  const current = isSameMonth(date, currentMonth);
  const today = dateKey === todayKey;

  return (
    <button
      type="button"
      className={`day-card ${current ? "" : "day-card--muted"} ${today ? "day-card--today" : ""}`}
      onClick={() => onSelect(dateKey)}
    >
      <div className="day-card__top">
        <strong>{date.getDate()}</strong>
        {dayEntries.length > 0 && <span className="badge">{dayEntries.length}</span>}
      </div>

      <div className="day-card__content">
        <div className="day-card__desktop">
          {dayEntries.slice(0, 2).map((entry) => (
            <div key={`${entry.id}-${dateKey}`} className="day-chip" title={entry.name}>
              {entry.name}
            </div>
          ))}

          {dayEntries.length > 2 && (
            <div className="day-card__more">+ ще {dayEntries.length - 2}</div>
          )}
        </div>

        <div className="day-card__mobile">
          {dayEntries.slice(0, 2).map((entry) => (
            <span
              key={`${entry.id}-${dateKey}-mobile`}
              className="mobile-initial"
              title={entry.name}
            >
              {getInitials(entry.name)}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ name: "", date: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadEntries = async () => {
    if (!session) {
      setEntries([]);
      setLoading(false);
      return;
    }

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
  }, [session]);

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const entry of entries) {
      if (!map[entry.date]) map[entry.date] = [];
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const email = loginForm.email.trim();
    const password = loginForm.password;

    if (!email || !password) {
      setErrorMessage("Введи email і пароль");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message || "Не вдалося увійти");
    }
  };

  const handleLogout = async () => {
    setErrorMessage("");
    await supabase.auth.signOut();
    setEntries([]);
    setSelectedDate(null);
    setEditingId(null);
    setEditingName("");
  };

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
    const confirmed = window.confirm("Видалити всі твої записи?");
    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("day_off_entries").delete().not("id", "is", null);

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

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1 className="auth-title">Завантаження...</h1>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="auth-subtitle">Приватний доступ</div>
          <h1 className="auth-title">Вхід у календар</h1>
          <p className="auth-text">Увійти може лише твій акаунт із Supabase Auth.</p>

          {errorMessage && <div className="error-box">{errorMessage}</div>}

          <div className="field">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label className="label">Пароль</label>
            <input
              className="input"
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <button className="primary-button auth-button" type="submit">
            Увійти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="layout">
        <div className="card">
          <div className="header-row">
            <div>
              <div className="subtitle">Календар day off · private mode</div>
              <h1 className="title">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h1>
            </div>

            <div className="button-row">
              <button
                className="button"
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                  )
                }
              >
                ← Назад
              </button>

              <button
                className="button"
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                  )
                }
              >
                Вперед →
              </button>

              <button className="danger-button" type="button" onClick={handleDeleteAll} disabled={saving}>
                Очистити все
              </button>

              <button className="button" type="button" onClick={handleLogout}>
                Вийти
              </button>
            </div>
          </div>

          {loading && <div className="loading-box">Завантаження даних із Supabase...</div>}
          {errorMessage && <div className="error-box">{errorMessage}</div>}

          <div className="card card--inner">
            <div className="field">
              <label className="label">Ім’я</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Наприклад, Марина Шевченко"
              />
            </div>

            <div className="field">
              <label className="label">Дата</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <button className="primary-button" type="button" onClick={handleAddEntry} disabled={saving}>
              {saving ? "Збереження..." : "Додати day off"}
            </button>
          </div>

          <div className="space-16" />

          <div className="week-grid">
            {weekDays.map((day) => (
              <div key={day} className="week-day">
                {day}
              </div>
            ))}
          </div>

          <div className="day-grid">
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

        <div className="side-stack">
          <div className="card">
            <h2 className="section-title">Огляд місяця</h2>

            <div className="stat-box">
              <div className="small-muted">Людей із day off цього місяця</div>
              <div className="stat-value">{summary.peopleCount}</div>
            </div>

            <div className="space-12" />

            <div className="stat-box">
              <div className="small-muted">Заброньовано day off днів</div>
              <div className="stat-value">{summary.totalBookedDays}</div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">
              {selectedDate ? `Записи на ${selectedDate}` : "Вибери день"}
            </h2>

            {selectedDate ? (
              selectedDayEntries.length > 0 ? (
                selectedDayEntries.map((entry) => (
                  <div key={entry.id} className="item-row">
                    <div className="text-block">
                      {editingId === entry.id ? (
                        <>
                          <input
                            className="input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Нове ім'я"
                          />
                          <div className="small-muted mt-8">{entry.date}</div>
                        </>
                      ) : (
                        <>
                          <div className="name-text" title={entry.name}>
                            {entry.name}
                          </div>
                          <div className="small-muted">{entry.date}</div>
                        </>
                      )}
                    </div>

                    <div className="action-row">
                      {editingId === entry.id ? (
                        <>
                          <button
                            className="button"
                            type="button"
                            onClick={() => handleSaveEdit(entry.id)}
                            disabled={saving}
                          >
                            Зберегти
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Скасувати
                          </button>
                        </>
                      ) : (
                        <button
                          className="button"
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          disabled={saving}
                        >
                          Редагувати
                        </button>
                      )}

                      <button
                        className="button"
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={saving}
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="stat-box">На цей день ніхто не взяв day off.</div>
              )
            ) : (
              <div className="stat-box">Клікни на дату в календарі, щоб побачити записи.</div>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Усі записи</h2>
            <div className="small-muted mb-12">
              Дані зберігаються в Supabase і доступні тільки після входу.
            </div>

            {entries
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((entry) => (
                <div key={entry.id} className="item-row">
                  <div className="text-block">
                    {editingId === entry.id ? (
                      <>
                        <input
                          className="input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Нове ім'я"
                        />
                        <div className="small-muted mt-8">{entry.date}</div>
                      </>
                    ) : (
                      <>
                        <div className="name-text" title={entry.name}>
                          {entry.name}
                        </div>
                        <div className="small-muted">{entry.date}</div>
                      </>
                    )}
                  </div>

                  <div className="action-row">
                    {editingId === entry.id ? (
                      <>
                        <button
                          className="button"
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={saving}
                        >
                          Зберегти
                        </button>
                        <button
                          className="button"
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Скасувати
                        </button>
                      </>
                    ) : (
                      <button
                        className="button"
                        type="button"
                        onClick={() => handleStartEdit(entry)}
                        disabled={saving}
                      >
                        Редагувати
                      </button>
                    )}

                    <button
                      className="button"
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={saving}
                    >
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