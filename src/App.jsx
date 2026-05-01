import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { DayPicker } from "react-day-picker";
import { uk } from "react-day-picker/locale";
import "react-day-picker/dist/style.css";

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

const monthNamesGenitive = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

const weekDaysShort = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MAX_PEOPLE_PER_DAY = 2;

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatDisplayDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = monthNamesGenitive[month - 1];
  const weekDay = weekDaysShort[date.getDay()];
  return `${day} ${monthName} (${weekDay})`;
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
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseDateString(dateString) {
  if (!dateString) return undefined;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
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
            <div
              key={`${entry.id}-${dateKey}`}
              className="day-chip"
              title={entry.member?.full_name || "Без імені"}
            >
              {entry.member?.full_name || "—"}
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
              title={entry.member?.full_name || "Без імені"}
            >
              {getInitials(entry.member?.full_name || "")}
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

  const createCalendarRef = useRef(null);
  const editCalendarRef = useRef(null);

  const [teamMembers, setTeamMembers] = useState([]);
  const [memberStatuses, setMemberStatuses] = useState([]);
  const [entries, setEntries] = useState([]);

  const [selectedDate, setSelectedDate] = useState(null);

  const [memberForm, setMemberForm] = useState({ fullName: "" });
  const [bulkMembersText, setBulkMembersText] = useState("");

  const [dayOffForm, setDayOffForm] = useState({
    memberId: "",
    date: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState({
    memberId: "",
    date: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [openEditCalendarId, setOpenEditCalendarId] = useState(null);

  const flashTimerRef = useRef(null);

  const currentMonthKey = useMemo(() => getMonthKey(currentMonth), [currentMonth]);

  const clearFlashMessage = () => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = setTimeout(() => {
      setSuccessMessage("");
    }, 2200);
  };

  const getStatusForMember = (memberId, monthKey = currentMonthKey) =>
    memberStatuses.find(
      (status) =>
        String(status.member_id) === String(memberId) && status.month_key === monthKey
    );

  const isMemberExcludedForMonth = (memberId, monthKey = currentMonthKey) =>
    Boolean(getStatusForMember(memberId, monthKey)?.is_excluded);

  const getConflictMessage = (entriesList, memberId, date, excludeId = null) => {
    const sameDateEntries = entriesList.filter(
      (entry) => entry.date === date && entry.id !== excludeId
    );

    const duplicatePerson = sameDateEntries.some(
      (entry) => String(entry.member_id) === String(memberId)
    );

    if (duplicatePerson) {
      return "Ця людина вже має day off на цю дату.";
    }

    if (sameDateEntries.length >= MAX_PEOPLE_PER_DAY) {
      return `На цю дату вже є максимум ${MAX_PEOPLE_PER_DAY} людини.`;
    }

    return "";
  };

  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("id, full_name, is_active, created_at")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMessage(error.message || "Не вдалося завантажити команду");
      return;
    }

    setTeamMembers(data || []);
  };

  const loadMonthlyStatuses = async () => {
    const { data, error } = await supabase
      .from("monthly_member_status")
      .select("id, member_id, month_key, is_excluded, note")
      .eq("month_key", currentMonthKey);

    if (error) {
      setErrorMessage(error.message || "Не вдалося завантажити місячні статуси");
      return;
    }

    setMemberStatuses(data || []);
  };

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
      .select(`
        id,
        member_id,
        date,
        created_at,
        member:team_members!day_off_entries_member_id_fkey (
          id,
          full_name
        )
      `)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message || "Не вдалося завантажити day off записи");
      setEntries([]);
    } else {
      setEntries(data || []);
    }

    setLoading(false);
  };

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
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    loadTeamMembers();
    loadEntries();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    loadMonthlyStatuses();
  }, [session, currentMonthKey]);

  useEffect(() => {
    if (!session) return undefined;

    const channel = supabase
      .channel("team-dayoff-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        () => {
          loadTeamMembers();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monthly_member_status" },
        () => {
          loadMonthlyStatuses();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_off_entries" },
        () => {
          loadEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, currentMonthKey]);

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

  const availableMembersForCurrentMonth = useMemo(() => {
    return teamMembers.filter((member) => !isMemberExcludedForMonth(member.id));
  }, [teamMembers, memberStatuses, currentMonthKey]);

  const summary = useMemo(() => {
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();

    const people = new Set();
    let totalBookedDays = 0;

    entries.forEach((entry) => {
      const [year, month] = entry.date.split("-").map(Number);
      if (year === currentYear && month - 1 === currentMonthIndex) {
        totalBookedDays += 1;
        if (entry.member?.full_name) {
          people.add(normalizeName(entry.member.full_name));
        }
      }
    });

    return { peopleCount: people.size, totalBookedDays };
  }, [entries, currentMonth]);

  const membersWithDayOffThisMonth = useMemo(() => {
    const set = new Set();

    entries.forEach((entry) => {
      if (entry.date.slice(0, 7) === currentMonthKey) {
        set.add(String(entry.member_id));
      }
    });

    return set;
  }, [entries, currentMonthKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isCreateCalendarOpen &&
        createCalendarRef.current &&
        !createCalendarRef.current.contains(event.target)
      ) {
        setIsCreateCalendarOpen(false);
      }

      if (
        openEditCalendarId !== null &&
        editCalendarRef.current &&
        !editCalendarRef.current.contains(event.target)
      ) {
        setOpenEditCalendarId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreateCalendarOpen, openEditCalendarId]);

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
    setSuccessMessage("");
    await supabase.auth.signOut();
    setEntries([]);
    setTeamMembers([]);
    setMemberStatuses([]);
    setSelectedDate(null);
    setEditingId(null);
    setEditingForm({ memberId: "", date: "" });
  };

  const handleAddMember = async () => {
    const fullName = memberForm.fullName.trim();
    if (!fullName) return;

    const duplicate = teamMembers.some(
      (member) => normalizeName(member.full_name) === normalizeName(fullName)
    );

    if (duplicate) {
      setErrorMessage("Така людина вже є в команді.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("team_members").insert([
      {
        full_name: fullName,
      },
    ]);

    if (error) {
      setErrorMessage(error.message || "Не вдалося додати людину");
      setSaving(false);
      return;
    }

    setMemberForm({ fullName: "" });
    setSuccessMessage("Людину додано");
    clearFlashMessage();
    setSaving(false);
  };

  const handleDeleteMember = async (member) => {
    const confirmed = window.confirm(
      `Видалити ${member.full_name} зі списку?\n\n` +
      `Також будуть видалені всі її day off записи та місячні статуси.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      setErrorMessage(error.message || "Не вдалося видалити людину");
      setSaving(false);
      return;
    }

    if (String(dayOffForm.memberId) === String(member.id)) {
      setDayOffForm((prev) => ({ ...prev, memberId: "" }));
    }

    if (String(editingForm.memberId) === String(member.id)) {
      setEditingId(null);
      setOpenEditCalendarId(null);
      setEditingForm({ memberId: "", date: "" });
    }

    setSuccessMessage("Людину видалено");
    clearFlashMessage();
    setSaving(false);
  };

  const handleBulkAddMembers = async () => {
    const rows = bulkMembersText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!rows.length) return;

    const existingNames = new Set(teamMembers.map((member) => normalizeName(member.full_name)));
    const dedupedRows = [];
    const seen = new Set();

    for (const row of rows) {
      const normalized = normalizeName(row);
      if (!normalized) continue;
      if (existingNames.has(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      dedupedRows.push({ full_name: row });
    }

    if (!dedupedRows.length) {
      setErrorMessage("Усі люди з цього списку вже є в команді.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("team_members").insert(dedupedRows);

    if (error) {
      setErrorMessage(error.message || "Не вдалося додати список людей");
      setSaving(false);
      return;
    }

    setBulkMembersText("");
    setSuccessMessage("Список людей додано");
    clearFlashMessage();
    setSaving(false);
  };

  const handleToggleMemberExclusion = async (memberId) => {
    const existing = getStatusForMember(memberId, currentMonthKey);

    setSaving(true);
    setErrorMessage("");

    if (existing) {
      const { error } = await supabase
        .from("monthly_member_status")
        .update({ is_excluded: !existing.is_excluded })
        .eq("id", existing.id);

      if (error) {
        setErrorMessage(error.message || "Не вдалося оновити статус");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("monthly_member_status").insert([
        {
          member_id: memberId,
          month_key: currentMonthKey,
          is_excluded: true,
        },
      ]);

      if (error) {
        setErrorMessage(error.message || "Не вдалося створити статус");
        setSaving(false);
        return;
      }
    }

    const editingThisMember = String(editingForm.memberId) === String(memberId);
    const creatingThisMember = String(dayOffForm.memberId) === String(memberId);

    if (editingThisMember && !selectedDayEntries.some((entry) => String(entry.member_id) === String(memberId))) {
      setEditingForm((prev) => ({ ...prev, memberId: "" }));
    }

    if (creatingThisMember) {
      setDayOffForm((prev) => ({ ...prev, memberId: "" }));
    }

    setSuccessMessage("Статус на місяць оновлено");
    clearFlashMessage();
    setSaving(false);
  };

  const handleAddEntry = async () => {
    if (!dayOffForm.memberId || !dayOffForm.date) return;

    const monthKey = dayOffForm.date.slice(0, 7);

    if (isMemberExcludedForMonth(dayOffForm.memberId, monthKey)) {
      setErrorMessage("Ця людина не бере участі в day off цього місяця.");
      return;
    }

    const conflictMessage = getConflictMessage(entries, dayOffForm.memberId, dayOffForm.date);
    if (conflictMessage) {
      setErrorMessage(conflictMessage);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("day_off_entries").insert([
      {
        member_id: Number(dayOffForm.memberId),
        date: dayOffForm.date,
      },
    ]);

    if (error) {
      setErrorMessage(error.message || "Не вдалося додати запис");
      setSaving(false);
      return;
    }

    setDayOffForm({ memberId: "", date: "" });
    setIsCreateCalendarOpen(false);
    setSuccessMessage("Запис додано");
    clearFlashMessage();
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
      setEditingForm({ memberId: "", date: "" });
    }

    setSuccessMessage("Запис видалено");
    clearFlashMessage();
    setSaving(false);
  };

  const handleStartEdit = (entry) => {
    setIsCreateCalendarOpen(false);
    setOpenEditCalendarId(null);
    setEditingId(entry.id);
    setEditingForm({
      memberId: String(entry.member_id),
      date: entry.date,
    });
    setErrorMessage("");
  };

  const handleSaveEdit = async (id) => {
    if (!editingForm.memberId || !editingForm.date) return;

    const monthKey = editingForm.date.slice(0, 7);

    if (isMemberExcludedForMonth(editingForm.memberId, monthKey)) {
      setErrorMessage("Ця людина не бере участі в day off цього місяця.");
      return;
    }

    const conflictMessage = getConflictMessage(
      entries,
      editingForm.memberId,
      editingForm.date,
      id
    );
    if (conflictMessage) {
      setErrorMessage(conflictMessage);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("day_off_entries")
      .update({
        member_id: Number(editingForm.memberId),
        date: editingForm.date,
      })
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message || "Не вдалося оновити запис");
      setSaving(false);
      return;
    }

    setEditingId(null);
    setOpenEditCalendarId(null);
    setEditingForm({ memberId: "", date: "" });
    setSuccessMessage("Запис оновлено");
    clearFlashMessage();
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setOpenEditCalendarId(null);
    setEditingForm({ memberId: "", date: "" });
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
              <div className="subtitle">Календар day off · team mode</div>
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

              <button className="button" type="button" onClick={handleLogout}>
                Вийти
              </button>
            </div>
          </div>

          {loading && <div className="loading-box">Завантаження даних із Supabase...</div>}
          {errorMessage && <div className="error-box">{errorMessage}</div>}
          {successMessage && <div className="success-box">{successMessage}</div>}

          <div className="card card--inner">
            <div className="field">
              <label className="label">Людина</label>
              <select
                className="input"
                value={dayOffForm.memberId}
                onChange={(e) =>
                  setDayOffForm((prev) => ({ ...prev, memberId: e.target.value }))
                }
              >
                <option value="">Оберіть людину</option>
                {availableMembersForCurrentMonth.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label">Дата</label>

              <button
                type="button"
                className="input date-trigger"
                onClick={() => setIsCreateCalendarOpen((prev) => !prev)}
              >
                {dayOffForm.date ? formatDisplayDate(dayOffForm.date) : "Обери дату"}
              </button>

              {isCreateCalendarOpen && (
                <div className="calendar-popover" ref={createCalendarRef}>
                  <DayPicker locale={uk}
                    mode="single"
                    selected={parseDateString(dayOffForm.date)}
                    month={currentMonth}
                    fromMonth={currentMonth}
                    toMonth={currentMonth}
                    onSelect={(date) => {
                      if (!date) return;
                      setDayOffForm((prev) => ({
                        ...prev,
                        date: formatDateKey(date),
                      }));
                      setIsCreateCalendarOpen(false);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="small-muted mb-12">
              Ліміт: максимум {MAX_PEOPLE_PER_DAY} людини на день. Виключені цього місяця в список не потрапляють.
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={handleAddEntry}
              disabled={saving}
            >
              {saving ? "Збереження..." : "Видати day off"}
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
            <h2 className="section-title">Команда</h2>

            <div className="field">
              <label className="label">Додати одну людину</label>
              <div className="compact-edit-grid">
                <input
                  className="input"
                  value={memberForm.fullName}
                  onChange={(e) =>
                    setMemberForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  placeholder="Ім'я Прізвище"
                />
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleAddMember}
                  disabled={saving}
                >
                  Додати
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">Додати списком</label>
              <textarea
                className="input"
                value={bulkMembersText}
                onChange={(e) => setBulkMembersText(e.target.value)}
                placeholder={"Іван Петренко\nМарина Шевченко\nОлег Коваль"}
                rows={5}
              />
            </div>

            <button
              className="button"
              type="button"
              onClick={handleBulkAddMembers}
              disabled={saving}
            >
              Додати список
            </button>

            <div className="space-16" />

            <div className="compact-list-header">
              <div>
                <h2 className="section-title compact-title">Учасники місяця</h2>
                <div className="small-muted compact-subtitle">
                  Відмічай, хто не бере участі в {monthNamesGenitive[currentMonth.getMonth()]}
                </div>
              </div>
              <div className="small-muted compact-count">Всього: {teamMembers.length}</div>
            </div>

            <div className="compact-list">
              {teamMembers
                .slice()
                .sort((a, b) => {
                  const aExcluded = isMemberExcludedForMonth(a.id);
                  const bExcluded = isMemberExcludedForMonth(b.id);

                  const aHasDayOff = membersWithDayOffThisMonth.has(String(a.id));
                  const bHasDayOff = membersWithDayOffThisMonth.has(String(b.id));

                  if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
                  if (aHasDayOff !== bHasDayOff) return aHasDayOff ? 1 : -1;

                  return a.full_name.localeCompare(b.full_name);
                })
                .map((member) => {
                  const excluded = isMemberExcludedForMonth(member.id);
                  const hasDayOffThisMonth = membersWithDayOffThisMonth.has(String(member.id));

                  return (
                    <div key={member.id} className="compact-row">
                      <div className="compact-main">
                        <div className="compact-name" title={member.full_name}>
                          {member.full_name}
                        </div>

                        <div className="member-statuses">
                          {!excluded && (
                            <span
                              className={`member-status-badge ${hasDayOffThisMonth
                                ? "member-status-badge--done"
                                : "member-status-badge--pending"
                                }`}
                            >
                              {hasDayOffThisMonth ? "Взяв day off" : "Ще не взяв"}
                            </span>
                          )}

                          <span
                            className={`member-status-badge ${excluded
                              ? "member-status-badge--excluded"
                              : "member-status-badge--active"
                              }`}
                          >
                            {excluded ? "Не бере участі" : "Актив"}
                          </span>
                        </div>
                      </div>

                      <div className="compact-actions">
                        <button
                          className={`button compact-button ${excluded ? "compact-button--danger" : ""}`}
                          type="button"
                          onClick={() => handleToggleMemberExclusion(member.id)}
                          disabled={saving}
                        >
                          {excluded ? "Повернути" : "Виключити"}
                        </button>

                        <button
                          className="button compact-button compact-button--danger"
                          type="button"
                          onClick={() => handleDeleteMember(member)}
                          disabled={saving}
                        >
                          Вид.
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="card">
            <div className="compact-list-header">
              <div>
                <h2 className="section-title compact-title">
                  {selectedDate ? `Записи на ${formatDisplayDate(selectedDate)}` : "Вибери день"}
                </h2>
                <div className="small-muted compact-subtitle">
                  {selectedDate
                    ? `Людей на дату: ${selectedDayEntries.length}`
                    : "Вибери день у календарі"}
                </div>
              </div>

              {selectedDate && (
                <div className="small-muted compact-count">
                  Всього: {selectedDayEntries.length}
                </div>
              )}
            </div>

            {selectedDate ? (
              selectedDayEntries.length > 0 ? (
                <div className="compact-list">
                  {selectedDayEntries
                    .slice()
                    .sort((a, b) =>
                      (a.member?.full_name || "").localeCompare(b.member?.full_name || "")
                    )
                    .map((entry) => (
                      <div key={entry.id} className="compact-row">
                        <div className="compact-main">
                          {editingId === entry.id ? (
                            <div className="compact-edit-grid">
                              <select
                                className="input compact-input"
                                value={editingForm.memberId}
                                onChange={(e) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    memberId: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Оберіть людину</option>
                                {availableMembersForCurrentMonth.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.full_name}
                                  </option>
                                ))}
                              </select>

                              <div className="edit-date-picker">
                                <button
                                  type="button"
                                  className="input compact-input date-trigger"
                                  onClick={() =>
                                    setOpenEditCalendarId((prev) => (prev === entry.id ? null : entry.id))
                                  }
                                >
                                  {editingForm.date ? formatDisplayDate(editingForm.date) : "Обери дату"}
                                </button>

                                {openEditCalendarId === entry.id && (
                                  <div className="calendar-popover calendar-popover--floating" ref={editCalendarRef}>
                                    <DayPicker locale={uk}
                                      mode="single"
                                      selected={parseDateString(editingForm.date)}
                                      month={currentMonth}
                                      fromMonth={currentMonth}
                                      toMonth={currentMonth}
                                      onSelect={(date) => {
                                        if (!date) return;
                                        setEditingForm((prev) => ({
                                          ...prev,
                                          date: formatDateKey(date),
                                        }));
                                        setOpenEditCalendarId(null);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className="compact-name"
                                title={entry.member?.full_name || "Без імені"}
                              >
                                {entry.member?.full_name || "—"}
                              </div>
                              <div className="compact-date">
                                {formatDisplayDate(entry.date)}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="compact-actions">
                          {editingId === entry.id ? (
                            <>
                              <button
                                className="button compact-button"
                                type="button"
                                onClick={() => handleSaveEdit(entry.id)}
                                disabled={saving}
                              >
                                Зберегти
                              </button>
                              <button
                                className="button compact-button"
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                Скасувати
                              </button>
                            </>
                          ) : (
                            <button
                              className="button compact-button"
                              type="button"
                              onClick={() => handleStartEdit(entry)}
                              disabled={saving}
                            >
                              Ред.
                            </button>
                          )}

                          <button
                            className="button compact-button compact-button--danger"
                            type="button"
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={saving}
                          >
                            Вид.
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="stat-box">На цю дату ще немає записів.</div>
              )
            ) : (
              <div className="stat-box">Клікни на дату в календарі, щоб побачити записи.</div>
            )}
          </div>

          <div className="card">
            <div className="compact-list-header">
              <div>
                <h2 className="section-title compact-title">Усі записи</h2>
                <div className="small-muted compact-subtitle">
                  Усі day off одним списком
                </div>
              </div>
              <div className="small-muted compact-count">Всього: {entries.length}</div>
            </div>

            <div className="compact-list">
              {entries
                .slice()
                .sort((a, b) => {
                  const byDate = a.date.localeCompare(b.date);
                  if (byDate !== 0) return byDate;
                  return (a.member?.full_name || "").localeCompare(b.member?.full_name || "");
                })
                .map((entry) => (
                  <div key={entry.id} className="compact-row">
                    <div className="compact-main">
                      {editingId === entry.id ? (
                        <div className="compact-edit-grid">
                          <select
                            className="input compact-input"
                            value={editingForm.memberId}
                            onChange={(e) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                memberId: e.target.value,
                              }))
                            }
                          >
                            <option value="">Оберіть людину</option>
                            {availableMembersForCurrentMonth.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.full_name}
                              </option>
                            ))}
                          </select>

                          <div className="edit-date-picker">
                            <button
                              type="button"
                              className="input compact-input date-trigger"
                              onClick={() =>
                                setOpenEditCalendarId((prev) => (prev === entry.id ? null : entry.id))
                              }
                            >
                              {editingForm.date ? formatDisplayDate(editingForm.date) : "Обери дату"}
                            </button>

                            {openEditCalendarId === entry.id && (
                              <div className="calendar-popover calendar-popover--floating" ref={editCalendarRef}>
                                <DayPicker locale={uk}
                                  mode="single"
                                  selected={parseDateString(editingForm.date)}
                                  month={currentMonth}
                                  fromMonth={currentMonth}
                                  toMonth={currentMonth}
                                  onSelect={(date) => {
                                    if (!date) return;
                                    setEditingForm((prev) => ({
                                      ...prev,
                                      date: formatDateKey(date),
                                    }));
                                    setOpenEditCalendarId(null);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className="compact-name"
                            title={entry.member?.full_name || "Без імені"}
                          >
                            {entry.member?.full_name || "—"}
                          </div>
                          <div className="compact-date">
                            {formatDisplayDate(entry.date)}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="compact-actions">
                      {editingId === entry.id ? (
                        <>
                          <button
                            className="button compact-button"
                            type="button"
                            onClick={() => handleSaveEdit(entry.id)}
                            disabled={saving}
                          >
                            Зберегти
                          </button>
                          <button
                            className="button compact-button"
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Скасувати
                          </button>
                        </>
                      ) : (
                        <button
                          className="button compact-button"
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          disabled={saving}
                        >
                          Ред.
                        </button>
                      )}

                      <button
                        className="button compact-button compact-button--danger"
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={saving}
                      >
                        Вид.
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}