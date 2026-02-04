import { useState } from "react";

const projectData = {
  name: "Стратегия 2026",
  emoji: "📊",
  model: "Эксперт",
  modelIcon: "🎯",
  created: "28 января 2026",
};

const passport = {
  goal: "Разработать стратегию развития компании на 2026 год с фокусом на digital-каналы",
  context: "B2B компания, IT-услуги, 50 сотрудников, рынок РФ",
  helpers: ["📣 Маркетолог", "📊 Аналитик"],
  instruction: "Учитывай специфику российского B2B рынка. Все рекомендации должны быть практичными и реализуемыми командой из 3 маркетологов.",
};

const files = [
  { name: "Отчёт_2025.pdf", size: "2.4 МБ", type: "pdf" },
  { name: "Конкуренты_анализ.xlsx", size: "890 КБ", type: "xlsx" },
  { name: "Бюджет_маркетинг.xlsx", size: "340 КБ", type: "xlsx" },
];

const chats = [
  { id: 1, title: "Анализ конкурентов", messages: 24, updated: "Сегодня, 14:30", model: "🎯" },
  { id: 2, title: "SWOT-анализ", messages: 18, updated: "Сегодня, 11:15", model: "🎓" },
  { id: 3, title: "Бюджет на Q1", messages: 8, updated: "Вчера", model: "⚡" },
  { id: 4, title: "Контент-план", messages: 31, updated: "27 янв", model: "🎯" },
];

function SectionTitle({ children, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 12, marginTop: 0,
    }}>
      <h3 style={{
        fontSize: 13, fontWeight: 600, color: "#6b7280",
        textTransform: "uppercase", letterSpacing: "0.05em",
        margin: 0,
      }}>
        {children}
      </h3>
      {action}
    </div>
  );
}

function SmallButton({ children, onClick, variant = "default" }) {
  const styles = {
    default: { background: "none", border: "1px solid #e5e7eb", color: "#6b7280" },
    primary: { background: "#3b82f6", border: "1px solid #3b82f6", color: "white" },
  };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles[variant],
        borderRadius: 6, padding: "4px 10px", cursor: "pointer",
        fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function SimplyProjectPage() {
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState("passport");

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: "#6b7280", padding: "4px 0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ← Главная
          </button>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
            {projectData.emoji} {projectData.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ⚙️ Настроить
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
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Chat Input — same pattern as Главная */}
        <section style={{ marginBottom: 36 }}>
          <div style={{
            background: "white", borderRadius: 16, border: "1px solid #d1d5db",
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <input
              type="text"
              placeholder="Спросите по проекту..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 16,
                color: "#111827", background: "transparent",
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {/* Model selector */}
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "#f3f4f6", borderRadius: 6, padding: "4px 10px",
                fontSize: 13, color: "#374151", cursor: "pointer",
              }}>
                {projectData.modelIcon} {projectData.model} ▾
              </div>
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

        {/* Two-column layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}>

          {/* Left column — Project context */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Passport */}
            <div style={{
              background: "white", borderRadius: 12, border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex", borderBottom: "1px solid #e5e7eb",
              }}>
                {[
                  { key: "passport", label: "Паспорт" },
                  { key: "instruction", label: "Инструкция" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 500,
                      background: "none", border: "none", cursor: "pointer",
                      color: activeTab === tab.key ? "#3b82f6" : "#6b7280",
                      borderBottom: activeTab === tab.key ? "2px solid #3b82f6" : "2px solid transparent",
                      transition: "all 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: "16px 20px" }}>
                {activeTab === "passport" ? (
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Цель</div>
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{passport.goal}</div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Контекст</div>
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{passport.context}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Помощники</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {passport.helpers.map((h, i) => (
                          <span key={i} style={{
                            fontSize: 13, background: "#f3f4f6", borderRadius: 6,
                            padding: "4px 10px", color: "#374151",
                          }}>{h}</span>
                        ))}
                        <span style={{
                          fontSize: 13, background: "#f3f4f6", borderRadius: 6,
                          padding: "4px 10px", color: "#9ca3af", cursor: "pointer",
                        }}>+ добавить</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                    {passport.instruction}
                  </div>
                )}
              </div>
            </div>

            {/* Files */}
            <div style={{
              background: "white", borderRadius: 12, border: "1px solid #e5e7eb",
              padding: "16px 20px",
            }}>
              <SectionTitle
                action={<SmallButton>+ Загрузить</SmallButton>}
              >
                Файлы ({files.length})
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 8, background: "#f9fafb",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}
                  >
                    <span style={{ fontSize: 16 }}>
                      {f.type === "pdf" ? "📕" : f.type === "xlsx" ? "📗" : "📄"}
                    </span>
                    <span style={{ fontSize: 14, color: "#374151", flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{f.size}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12, padding: "12px", borderRadius: 8,
                border: "1px dashed #d1d5db", textAlign: "center",
                fontSize: 13, color: "#9ca3af", cursor: "pointer",
              }}>
                Перетащите файлы сюда
              </div>
            </div>
          </div>

          {/* Right column — Chats */}
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e5e7eb",
            padding: "16px 20px",
          }}>
            <SectionTitle
              action={<SmallButton variant="primary">+ Новый чат</SmallButton>}
            >
              Чаты ({chats.length})
            </SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {chats.map(chat => (
                <div key={chat.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  transition: "background 0.15s", background: "transparent",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 16 }}>{chat.model}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: "#111827",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {chat.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      {chat.messages} сообщений
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>
                    {chat.updated}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Project meta */}
        <div style={{
          marginTop: 32, padding: "12px 16px", borderRadius: 8,
          background: "#f3f4f6", display: "flex", gap: 24,
          fontSize: 12, color: "#9ca3af",
        }}>
          <span>Создан: {projectData.created}</span>
          <span>Модель по умолчанию: {projectData.modelIcon} {projectData.model}</span>
          <span>Чатов: {chats.length}</span>
          <span>Файлов: {files.length}</span>
        </div>
      </main>
    </div>
  );
}
