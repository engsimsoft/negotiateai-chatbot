import { useState } from "react";

const mockProjects = [
  { id: 1, name: "Стратегия 2026", emoji: "📊", chats: 4, updated: "Сегодня" },
  { id: 2, name: "Контент для VK", emoji: "📱", chats: 2, updated: "Вчера" },
  { id: 3, name: "Договор аренды", emoji: "📄", chats: 1, updated: "3 дня назад" },
];

const presetHelpers = [
  { id: 1, name: "Маркетолог", emoji: "📣", desc: "Стратегия, анализ рынка, позиционирование", chats: 3 },
  { id: 2, name: "Копирайтер", emoji: "✍️", desc: "Тексты, посты, рассылки", chats: 5 },
  { id: 3, name: "Переводчик", emoji: "🌍", desc: "Переводы с контекстом и адаптацией", chats: 0 },
  { id: 4, name: "Аналитик", emoji: "📊", desc: "Данные, отчёты, выводы", chats: 0 },
  { id: 5, name: "Наставник", emoji: "🎓", desc: "Обучение, объяснения, менторство", chats: 1 },
];

const customHelpers = [
  { id: 10, name: "Маркетолог Кофейни", emoji: "☕", desc: "Настроен под вашу кофейню", chats: 7, custom: true },
  { id: 11, name: "Контент Telegram", emoji: "✈️", desc: "Посты для вашего канала", chats: 12, custom: true },
];

const tools = [
  { id: 1, name: "Диктофон", emoji: "🎙️", desc: "Запись → текст", soon: true },
  { id: 2, name: "Исследование", emoji: "🔍", desc: "Глубокий анализ темы", soon: true },
  { id: 3, name: "Брифинг", emoji: "☀️", desc: "Утренний дайджест", soon: true },
];

function SectionTitle({ children, count }) {
  return (
    <div style={{ 
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 16, marginTop: 8
    }}>
      <h2 style={{ 
        fontSize: 15, fontWeight: 600, color: "#6b7280", 
        textTransform: "uppercase", letterSpacing: "0.05em",
        margin: 0
      }}>
        {children}
      </h2>
      {count !== undefined && (
        <span style={{ 
          fontSize: 12, color: "#9ca3af", background: "#f3f4f6",
          borderRadius: 10, padding: "2px 8px"
        }}>{count}</span>
      )}
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "16px 20px",
      border: "1px solid #e5e7eb", cursor: "pointer",
      transition: "all 0.15s ease",
      display: "flex", alignItems: "center", gap: 14,
      minWidth: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 24, flexShrink: 0 }}>{project.emoji}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {project.name}
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
          {project.chats} чатов · {project.updated}
        </div>
      </div>
    </div>
  );
}

function HelperCard({ helper }) {
  return (
    <div style={{
      background: helper.custom ? "#fefce8" : "white",
      borderRadius: 12, padding: "16px 20px",
      border: `1px solid ${helper.custom ? "#fde68a" : "#e5e7eb"}`,
      cursor: "pointer", transition: "all 0.15s ease",
      display: "flex", alignItems: "flex-start", gap: 14,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = helper.custom ? "#fde68a" : "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>{helper.emoji}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{helper.name}</span>
          {helper.custom && (
            <span style={{ fontSize: 10, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "1px 6px", fontWeight: 500 }}>свой</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{helper.desc}</div>
        {helper.chats > 0 && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{helper.chats} чатов</div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ tool }) {
  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "14px 18px",
      border: "1px solid #e5e7eb", cursor: tool.soon ? "default" : "pointer",
      transition: "all 0.15s ease",
      display: "flex", alignItems: "center", gap: 12,
      opacity: tool.soon ? 0.6 : 1,
    }}
      onMouseEnter={e => { if (!tool.soon) { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.08)"; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 20 }}>{tool.emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{tool.name}</div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{tool.desc}</div>
      </div>
      {tool.soon && (
        <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontWeight: 500 }}>Скоро</span>
      )}
    </div>
  );
}

function NewProjectButton() {
  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "16px 20px",
      border: "2px dashed #d1d5db", cursor: "pointer",
      transition: "all 0.15s ease",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      color: "#6b7280", fontSize: 14, fontWeight: 500,
      minHeight: 72,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#6b7280"; }}
    >
      <span style={{ fontSize: 20 }}>＋</span> Новый проект
    </div>
  );
}

function ConstructorCard() {
  return (
    <div style={{
      background: "#f0f9ff", borderRadius: 12, padding: "16px 20px",
      border: "1px solid #bae6fd", cursor: "pointer",
      transition: "all 0.15s ease",
      display: "flex", alignItems: "flex-start", gap: 14,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#bae6fd"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>🛠️</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Конструктор</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Создайте помощника под свою задачу</div>
      </div>
    </div>
  );
}

export default function SimplyGlavnaya() {
  const [inputValue, setInputValue] = useState("");
  
  return (
    <div style={{ 
      minHeight: "100vh", background: "#f9fafb",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #e5e7eb",
        padding: "0 32px", height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          Simply
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{ 
            background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ❓ Бен
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "#3b82f6",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            В
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
        
        {/* Greeting */}
        <section style={{ marginBottom: 20 }}>
          <h1 style={{ 
            fontSize: 28, fontWeight: 700, color: "#111827", 
            margin: "0 0 6px", letterSpacing: "-0.02em"
          }}>
            Добрый день, Владимир
          </h1>
          <p style={{ fontSize: 15, color: "#9ca3af", margin: 0 }}>
            Чем могу помочь?
          </p>
        </section>

        {/* Chat History Card + Input — SAME LINE */}
        <section style={{ marginBottom: 48, display: "flex", gap: 12, alignItems: "stretch" }}>
          
          {/* Chat History Card */}
          <div 
            style={{
              background: "white", borderRadius: 16, border: "1px solid #e5e7eb",
              padding: "14px 18px", cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 10,
              flexShrink: 0, minWidth: 160,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
          >
            <div style={{ fontSize: 20 }}>💬</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>История чатов</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>12 чатов</div>
            </div>
            <div style={{ fontSize: 14, color: "#d1d5db", marginLeft: 4 }}>→</div>
          </div>

          {/* Input field */}
          <div style={{
            flex: 1,
            background: "white", borderRadius: 16, border: "1px solid #d1d5db",
            padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            transition: "border-color 0.15s",
          }}
            onFocus={e => e.currentTarget.style.borderColor = "#3b82f6"}
            onBlur={e => e.currentTarget.style.borderColor = "#d1d5db"}
          >
            <input
              type="text"
              placeholder="Спросите что угодно..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 16,
                color: "#111827", background: "transparent",
              }}
            />
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 18, color: "#9ca3af", padding: 4,
              }}>🎤</button>
              <button style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 18, color: "#9ca3af", padding: 4,
              }}>📎</button>
              <button style={{
                background: inputValue ? "#3b82f6" : "#e5e7eb",
                border: "none", borderRadius: 8, cursor: "pointer",
                padding: "6px 14px", color: inputValue ? "white" : "#9ca3af",
                fontSize: 14, fontWeight: 500, transition: "all 0.15s",
              }}>→</button>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle count={mockProjects.length}>Проекты</SectionTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
          }}>
            {mockProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            <NewProjectButton />
          </div>
        </section>

        {/* Helpers */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle count={presetHelpers.length + customHelpers.length}>Помощники</SectionTitle>
          
          {customHelpers.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12, marginBottom: 12,
            }}>
              {customHelpers.map(h => <HelperCard key={h.id} helper={h} />)}
            </div>
          )}
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}>
            {presetHelpers.map(h => <HelperCard key={h.id} helper={h} />)}
            <ConstructorCard />
          </div>
        </section>

        {/* Tools */}
        <section>
          <SectionTitle>Инструменты</SectionTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}>
            {tools.map(t => <ToolCard key={t.id} tool={t} />)}
          </div>
        </section>

      </main>
    </div>
  );
}
