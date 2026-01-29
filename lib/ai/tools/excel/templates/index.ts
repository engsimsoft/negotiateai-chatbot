/**
 * Excel Templates - 10 professional templates
 */

import type { ExcelTemplate } from "../types";

/**
 * 1. Family Budget - Семейный бюджет
 */
export const familyBudgetTemplate: ExcelTemplate = {
  id: "family-budget",
  name: "Семейный бюджет",
  description: "Учёт доходов и расходов семьи по категориям с планом и фактом",
  category: "budget",
  sheets: [
    {
      name: "Бюджет",
      columns: [
        { header: "Категория", key: "category", type: "text", width: 20 },
        { header: "План", key: "plan", type: "currency", width: 15 },
        { header: "Факт", key: "fact", type: "currency", width: 15 },
        { header: "Разница", key: "diff", type: "currency", width: 15 },
        { header: "% выполнения", key: "percent", type: "percent", width: 15 },
      ],
      data: [
        { category: "Продукты", plan: 25000, fact: 0, diff: 0, percent: 0 },
        { category: "Транспорт", plan: 8000, fact: 0, diff: 0, percent: 0 },
        { category: "Коммунальные услуги", plan: 7000, fact: 0, diff: 0, percent: 0 },
        { category: "Связь и интернет", plan: 2000, fact: 0, diff: 0, percent: 0 },
        { category: "Здоровье", plan: 3000, fact: 0, diff: 0, percent: 0 },
        { category: "Одежда", plan: 5000, fact: 0, diff: 0, percent: 0 },
        { category: "Развлечения", plan: 5000, fact: 0, diff: 0, percent: 0 },
        { category: "Накопления", plan: 10000, fact: 0, diff: 0, percent: 0 },
        { category: "ИТОГО", plan: 65000, fact: 0, diff: 0, percent: 0 },
      ],
      formulas: [
        { cell: "D2", formula: "B2-C2" },
        { cell: "E2", formula: "IF(B2=0,0,C2/B2)" },
        { cell: "D3", formula: "B3-C3" },
        { cell: "E3", formula: "IF(B3=0,0,C3/B3)" },
        { cell: "D4", formula: "B4-C4" },
        { cell: "E4", formula: "IF(B4=0,0,C4/B4)" },
        { cell: "D5", formula: "B5-C5" },
        { cell: "E5", formula: "IF(B5=0,0,C5/B5)" },
        { cell: "D6", formula: "B6-C6" },
        { cell: "E6", formula: "IF(B6=0,0,C6/B6)" },
        { cell: "D7", formula: "B7-C7" },
        { cell: "E7", formula: "IF(B7=0,0,C7/B7)" },
        { cell: "D8", formula: "B8-C8" },
        { cell: "E8", formula: "IF(B8=0,0,C8/B8)" },
        { cell: "D9", formula: "B9-C9" },
        { cell: "E9", formula: "IF(B9=0,0,C9/B9)" },
        { cell: "B10", formula: "SUM(B2:B9)" },
        { cell: "C10", formula: "SUM(C2:C9)" },
        { cell: "D10", formula: "B10-C10" },
        { cell: "E10", formula: "IF(B10=0,0,C10/B10)" },
      ],
      styles: {
        theme: "forest-green",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 2. Project Budget - Бюджет проекта
 */
export const projectBudgetTemplate: ExcelTemplate = {
  id: "project-budget",
  name: "Бюджет проекта",
  description: "Контроль бюджета проекта по статьям расходов",
  category: "business",
  sheets: [
    {
      name: "Бюджет проекта",
      columns: [
        { header: "Статья расходов", key: "item", type: "text", width: 25 },
        { header: "Бюджет", key: "budget", type: "currency", width: 15 },
        { header: "Потрачено", key: "spent", type: "currency", width: 15 },
        { header: "Остаток", key: "remaining", type: "currency", width: 15 },
        { header: "% использования", key: "usage", type: "percent", width: 15 },
      ],
      data: [
        { item: "Разработка", budget: 500000, spent: 0, remaining: 0, usage: 0 },
        { item: "Дизайн", budget: 150000, spent: 0, remaining: 0, usage: 0 },
        { item: "Тестирование", budget: 100000, spent: 0, remaining: 0, usage: 0 },
        { item: "Маркетинг", budget: 200000, spent: 0, remaining: 0, usage: 0 },
        { item: "Инфраструктура", budget: 50000, spent: 0, remaining: 0, usage: 0 },
        { item: "ИТОГО", budget: 1000000, spent: 0, remaining: 0, usage: 0 },
      ],
      formulas: [
        { cell: "D2", formula: "B2-C2" },
        { cell: "E2", formula: "IF(B2=0,0,C2/B2)" },
        { cell: "D3", formula: "B3-C3" },
        { cell: "E3", formula: "IF(B3=0,0,C3/B3)" },
        { cell: "D4", formula: "B4-C4" },
        { cell: "E4", formula: "IF(B4=0,0,C4/B4)" },
        { cell: "D5", formula: "B5-C5" },
        { cell: "E5", formula: "IF(B5=0,0,C5/B5)" },
        { cell: "D6", formula: "B6-C6" },
        { cell: "E6", formula: "IF(B6=0,0,C6/B6)" },
        { cell: "B7", formula: "SUM(B2:B6)" },
        { cell: "C7", formula: "SUM(C2:C6)" },
        { cell: "D7", formula: "B7-C7" },
        { cell: "E7", formula: "IF(B7=0,0,C7/B7)" },
      ],
      styles: {
        theme: "corporate-blue",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 3. Income/Expense for IP - Учёт доходов/расходов ИП
 */
export const ipIncomeExpenseTemplate: ExcelTemplate = {
  id: "ip-income-expense",
  name: "Учёт доходов/расходов ИП",
  description: "Журнал учёта доходов и расходов для индивидуального предпринимателя",
  category: "business",
  sheets: [
    {
      name: "Учёт",
      columns: [
        { header: "Дата", key: "date", type: "date", width: 12 },
        { header: "Тип", key: "type", type: "text", width: 10 },
        { header: "Описание", key: "description", type: "text", width: 30 },
        { header: "Категория", key: "category", type: "text", width: 15 },
        { header: "Сумма", key: "amount", type: "currency", width: 15 },
      ],
      data: [
        { date: "01.01.2026", type: "Доход", description: "Оплата по договору №1", category: "Услуги", amount: 50000 },
        { date: "05.01.2026", type: "Расход", description: "Аренда офиса", category: "Аренда", amount: -15000 },
        { date: "10.01.2026", type: "Расход", description: "Интернет и связь", category: "Связь", amount: -2000 },
        { date: "15.01.2026", type: "Доход", description: "Консультация", category: "Услуги", amount: 20000 },
      ],
      styles: {
        theme: "professional-gray",
        freezeHeader: true,
        alternateRows: true,
      },
    },
    {
      name: "Итоги",
      columns: [
        { header: "Показатель", key: "metric", type: "text", width: 25 },
        { header: "Сумма", key: "value", type: "currency", width: 15 },
      ],
      data: [
        { metric: "Всего доходов", value: 70000 },
        { metric: "Всего расходов", value: 17000 },
        { metric: "Прибыль", value: 53000 },
      ],
      styles: {
        theme: "professional-gray",
        freezeHeader: true,
      },
    },
  ],
};

/**
 * 4. Content Plan - Контент-план
 */
export const contentPlanTemplate: ExcelTemplate = {
  id: "content-plan",
  name: "Контент-план",
  description: "Планирование публикаций в социальных сетях",
  category: "marketing",
  sheets: [
    {
      name: "Контент-план",
      columns: [
        { header: "Дата", key: "date", type: "date", width: 12 },
        { header: "День", key: "day", type: "text", width: 12 },
        { header: "Площадка", key: "platform", type: "text", width: 15 },
        { header: "Тема", key: "topic", type: "text", width: 30 },
        { header: "Формат", key: "format", type: "text", width: 15 },
        { header: "Статус", key: "status", type: "text", width: 12 },
        { header: "Ответственный", key: "responsible", type: "text", width: 15 },
      ],
      data: [
        { date: "01.01.2026", day: "Понедельник", platform: "Telegram", topic: "Обзор новинок", format: "Текст + фото", status: "В работе", responsible: "" },
        { date: "02.01.2026", day: "Вторник", platform: "VK", topic: "Полезные советы", format: "Карусель", status: "Черновик", responsible: "" },
        { date: "03.01.2026", day: "Среда", platform: "Instagram", topic: "Behind the scenes", format: "Reels", status: "Идея", responsible: "" },
        { date: "04.01.2026", day: "Четверг", platform: "Telegram", topic: "Кейс клиента", format: "Текст", status: "Идея", responsible: "" },
        { date: "05.01.2026", day: "Пятница", platform: "VK", topic: "Пятничный юмор", format: "Мем", status: "Идея", responsible: "" },
      ],
      styles: {
        theme: "warm-orange",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 5. Media Plan - Медиаплан
 */
export const mediaPlanTemplate: ExcelTemplate = {
  id: "media-plan",
  name: "Медиаплан",
  description: "Планирование рекламных кампаний с расчётом ROI",
  category: "marketing",
  sheets: [
    {
      name: "Медиаплан",
      columns: [
        { header: "Канал", key: "channel", type: "text", width: 20 },
        { header: "Бюджет", key: "budget", type: "currency", width: 15 },
        { header: "Охват", key: "reach", type: "number", width: 12 },
        { header: "CPM", key: "cpm", type: "currency", width: 12 },
        { header: "Клики", key: "clicks", type: "number", width: 12 },
        { header: "CPC", key: "cpc", type: "currency", width: 12 },
        { header: "Конверсии", key: "conversions", type: "number", width: 12 },
        { header: "CPA", key: "cpa", type: "currency", width: 12 },
        { header: "Доход", key: "revenue", type: "currency", width: 15 },
        { header: "ROI", key: "roi", type: "percent", width: 10 },
      ],
      data: [
        { channel: "Яндекс.Директ", budget: 100000, reach: 500000, cpm: 0, clicks: 5000, cpc: 0, conversions: 100, cpa: 0, revenue: 300000, roi: 0 },
        { channel: "VK Реклама", budget: 50000, reach: 300000, cpm: 0, clicks: 3000, cpc: 0, conversions: 50, cpa: 0, revenue: 150000, roi: 0 },
        { channel: "Telegram Ads", budget: 30000, reach: 100000, cpm: 0, clicks: 1500, cpc: 0, conversions: 30, cpa: 0, revenue: 90000, roi: 0 },
        { channel: "ИТОГО", budget: 180000, reach: 900000, cpm: 0, clicks: 9500, cpc: 0, conversions: 180, cpa: 0, revenue: 540000, roi: 0 },
      ],
      formulas: [
        { cell: "D2", formula: "B2/E2*1000" },
        { cell: "F2", formula: "B2/E2" },
        { cell: "H2", formula: "B2/G2" },
        { cell: "J2", formula: "(I2-B2)/B2" },
        { cell: "D3", formula: "B3/E3*1000" },
        { cell: "F3", formula: "B3/E3" },
        { cell: "H3", formula: "B3/G3" },
        { cell: "J3", formula: "(I3-B3)/B3" },
        { cell: "D4", formula: "B4/E4*1000" },
        { cell: "F4", formula: "B4/E4" },
        { cell: "H4", formula: "B4/G4" },
        { cell: "J4", formula: "(I4-B4)/B4" },
        { cell: "B5", formula: "SUM(B2:B4)" },
        { cell: "C5", formula: "SUM(C2:C4)" },
        { cell: "E5", formula: "SUM(E2:E4)" },
        { cell: "G5", formula: "SUM(G2:G4)" },
        { cell: "I5", formula: "SUM(I2:I4)" },
        { cell: "D5", formula: "B5/C5*1000" },
        { cell: "F5", formula: "B5/E5" },
        { cell: "H5", formula: "B5/G5" },
        { cell: "J5", formula: "(I5-B5)/B5" },
      ],
      styles: {
        theme: "modern-teal",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 6. Invoice - Счёт/Инвойс
 */
export const invoiceTemplate: ExcelTemplate = {
  id: "invoice",
  name: "Счёт на оплату",
  description: "Счёт для клиентов с автоматическим расчётом НДС",
  category: "business",
  sheets: [
    {
      name: "Счёт",
      columns: [
        { header: "№", key: "num", type: "number", width: 5 },
        { header: "Наименование", key: "name", type: "text", width: 35 },
        { header: "Кол-во", key: "qty", type: "number", width: 10 },
        { header: "Ед.", key: "unit", type: "text", width: 8 },
        { header: "Цена", key: "price", type: "currency", width: 15 },
        { header: "Сумма", key: "amount", type: "currency", width: 15 },
      ],
      data: [
        { num: 1, name: "Услуга 1", qty: 1, unit: "шт", price: 10000, amount: 0 },
        { num: 2, name: "Услуга 2", qty: 2, unit: "шт", price: 5000, amount: 0 },
        { num: 3, name: "Услуга 3", qty: 1, unit: "шт", price: 15000, amount: 0 },
        { num: "", name: "Итого без НДС", qty: "", unit: "", price: "", amount: 0 },
        { num: "", name: "НДС 20%", qty: "", unit: "", price: "", amount: 0 },
        { num: "", name: "ИТОГО с НДС", qty: "", unit: "", price: "", amount: 0 },
      ],
      formulas: [
        { cell: "F2", formula: "C2*E2" },
        { cell: "F3", formula: "C3*E3" },
        { cell: "F4", formula: "C4*E4" },
        { cell: "F5", formula: "SUM(F2:F4)" },
        { cell: "F6", formula: "F5*0.2" },
        { cell: "F7", formula: "F5+F6" },
      ],
      styles: {
        theme: "professional-gray",
        freezeHeader: true,
        alternateRows: false,
      },
    },
  ],
};

/**
 * 7. Client Tracker - Учёт клиентов
 */
export const clientTrackerTemplate: ExcelTemplate = {
  id: "client-tracker",
  name: "Учёт клиентов",
  description: "CRM-таблица для отслеживания клиентов и сделок",
  category: "business",
  sheets: [
    {
      name: "Клиенты",
      columns: [
        { header: "Имя", key: "name", type: "text", width: 20 },
        { header: "Компания", key: "company", type: "text", width: 20 },
        { header: "Телефон", key: "phone", type: "text", width: 15 },
        { header: "Email", key: "email", type: "text", width: 25 },
        { header: "Статус", key: "status", type: "text", width: 12 },
        { header: "Сумма сделки", key: "dealAmount", type: "currency", width: 15 },
        { header: "Дата контакта", key: "contactDate", type: "date", width: 12 },
        { header: "Следующий шаг", key: "nextStep", type: "text", width: 25 },
      ],
      data: [
        { name: "Иван Петров", company: "ООО Альфа", phone: "+7 999 123-45-67", email: "ivan@alpha.ru", status: "Лид", dealAmount: 50000, contactDate: "15.01.2026", nextStep: "Отправить КП" },
        { name: "Мария Сидорова", company: "ИП Сидорова", phone: "+7 999 234-56-78", email: "maria@mail.ru", status: "В работе", dealAmount: 100000, contactDate: "20.01.2026", nextStep: "Встреча" },
        { name: "Алексей Козлов", company: "ЗАО Бета", phone: "+7 999 345-67-89", email: "kozlov@beta.ru", status: "Закрыт", dealAmount: 200000, contactDate: "10.01.2026", nextStep: "-" },
      ],
      styles: {
        theme: "corporate-blue",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 8. Vacation Schedule - График отпусков
 */
export const vacationScheduleTemplate: ExcelTemplate = {
  id: "vacation-schedule",
  name: "График отпусков",
  description: "Годовой график отпусков сотрудников",
  category: "hr",
  sheets: [
    {
      name: "График отпусков",
      columns: [
        { header: "Сотрудник", key: "employee", type: "text", width: 20 },
        { header: "Должность", key: "position", type: "text", width: 20 },
        { header: "Янв", key: "jan", type: "number", width: 6 },
        { header: "Фев", key: "feb", type: "number", width: 6 },
        { header: "Мар", key: "mar", type: "number", width: 6 },
        { header: "Апр", key: "apr", type: "number", width: 6 },
        { header: "Май", key: "may", type: "number", width: 6 },
        { header: "Июн", key: "jun", type: "number", width: 6 },
        { header: "Июл", key: "jul", type: "number", width: 6 },
        { header: "Авг", key: "aug", type: "number", width: 6 },
        { header: "Сен", key: "sep", type: "number", width: 6 },
        { header: "Окт", key: "oct", type: "number", width: 6 },
        { header: "Ноя", key: "nov", type: "number", width: 6 },
        { header: "Дек", key: "dec", type: "number", width: 6 },
        { header: "Всего", key: "total", type: "number", width: 8 },
      ],
      data: [
        { employee: "Иванов И.И.", position: "Менеджер", jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 14, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 14, total: 0 },
        { employee: "Петрова А.С.", position: "Бухгалтер", jan: 0, feb: 0, mar: 0, apr: 0, may: 14, jun: 0, jul: 14, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, total: 0 },
        { employee: "Сидоров В.П.", position: "Разработчик", jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 28, sep: 0, oct: 0, nov: 0, dec: 0, total: 0 },
      ],
      formulas: [
        { cell: "O2", formula: "SUM(C2:N2)" },
        { cell: "O3", formula: "SUM(C3:N3)" },
        { cell: "O4", formula: "SUM(C4:N4)" },
      ],
      styles: {
        theme: "forest-green",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 9. Comparison Table - Сравнительная таблица
 */
export const comparisonTableTemplate: ExcelTemplate = {
  id: "comparison-table",
  name: "Сравнительная таблица",
  description: "Сравнение вариантов по параметрам",
  category: "general",
  sheets: [
    {
      name: "Сравнение",
      columns: [
        { header: "Параметр", key: "parameter", type: "text", width: 25 },
        { header: "Вариант А", key: "optionA", type: "text", width: 20 },
        { header: "Вариант Б", key: "optionB", type: "text", width: 20 },
        { header: "Вариант В", key: "optionC", type: "text", width: 20 },
        { header: "Примечание", key: "note", type: "text", width: 25 },
      ],
      data: [
        { parameter: "Цена", optionA: "", optionB: "", optionC: "", note: "" },
        { parameter: "Качество", optionA: "", optionB: "", optionC: "", note: "" },
        { parameter: "Сроки", optionA: "", optionB: "", optionC: "", note: "" },
        { parameter: "Гарантия", optionA: "", optionB: "", optionC: "", note: "" },
        { parameter: "Поддержка", optionA: "", optionB: "", optionC: "", note: "" },
        { parameter: "ИТОГО баллов", optionA: "", optionB: "", optionC: "", note: "" },
      ],
      styles: {
        theme: "warm-orange",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

/**
 * 10. Task Tracker - Трекер задач
 */
export const taskTrackerTemplate: ExcelTemplate = {
  id: "task-tracker",
  name: "Трекер задач",
  description: "Управление задачами и проектами",
  category: "general",
  sheets: [
    {
      name: "Задачи",
      columns: [
        { header: "№", key: "id", type: "number", width: 5 },
        { header: "Задача", key: "task", type: "text", width: 35 },
        { header: "Проект", key: "project", type: "text", width: 15 },
        { header: "Статус", key: "status", type: "text", width: 12 },
        { header: "Приоритет", key: "priority", type: "text", width: 12 },
        { header: "Ответственный", key: "assignee", type: "text", width: 15 },
        { header: "Дедлайн", key: "deadline", type: "date", width: 12 },
        { header: "% готовности", key: "progress", type: "percent", width: 12 },
      ],
      data: [
        { id: 1, task: "Разработать дизайн главной страницы", project: "Сайт", status: "В работе", priority: "Высокий", assignee: "", deadline: "20.01.2026", progress: 0.5 },
        { id: 2, task: "Написать ТЗ для модуля оплаты", project: "Сайт", status: "На проверке", priority: "Высокий", assignee: "", deadline: "15.01.2026", progress: 0.9 },
        { id: 3, task: "Подготовить презентацию", project: "Маркетинг", status: "Не начато", priority: "Средний", assignee: "", deadline: "25.01.2026", progress: 0 },
        { id: 4, task: "Обновить базу клиентов", project: "CRM", status: "Не начато", priority: "Низкий", assignee: "", deadline: "30.01.2026", progress: 0 },
      ],
      styles: {
        theme: "modern-teal",
        freezeHeader: true,
        alternateRows: true,
      },
    },
  ],
};

// Export all templates
export const templates: Record<string, ExcelTemplate> = {
  "family-budget": familyBudgetTemplate,
  "project-budget": projectBudgetTemplate,
  "ip-income-expense": ipIncomeExpenseTemplate,
  "content-plan": contentPlanTemplate,
  "media-plan": mediaPlanTemplate,
  "invoice": invoiceTemplate,
  "client-tracker": clientTrackerTemplate,
  "vacation-schedule": vacationScheduleTemplate,
  "comparison-table": comparisonTableTemplate,
  "task-tracker": taskTrackerTemplate,
};

// Template list for AI context
export const templatesList = Object.values(templates).map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
}));

/**
 * Get template by ID or find by keywords
 */
export function getTemplate(idOrKeyword: string): ExcelTemplate | undefined {
  // Direct ID match
  if (templates[idOrKeyword]) {
    return templates[idOrKeyword];
  }

  // Keyword search
  const keyword = idOrKeyword.toLowerCase();
  const found = Object.values(templates).find(
    (t) =>
      t.name.toLowerCase().includes(keyword) ||
      t.description.toLowerCase().includes(keyword) ||
      t.id.includes(keyword)
  );

  return found;
}
