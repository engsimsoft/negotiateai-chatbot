export interface LibraryCollectionInfo {
  name: string;
  documentsCount: number;
  isDefault?: boolean;
}

export interface LibrarySourcesScope {
  collectionNames?: string[];
  documentNames?: string[];
}

export function buildLibraryContext(
  collections?: LibraryCollectionInfo[],
  scope?: LibrarySourcesScope,
): string {
  const scoped =
    (scope?.collectionNames?.length ?? 0) > 0 ||
    (scope?.documentNames?.length ?? 0) > 0;

  // Когда пользователь явно выбрал источники — показываем только их и
  // жёсткую инструкцию замкнуться в этом scope. Список всех коллекций
  // не нужен (он только запутает модель и расширит её ответы).
  if (scoped) {
    const lines = [
      "## Выбранные источники из Библиотеки",
      "",
      "Пользователь явно выбрал источники для этого диалога. Используй `librarySearch` ТОЛЬКО для поиска внутри них — все остальные коллекции и документы Библиотеки игнорируй. Если ответа в выбранных источниках нет — честно сообщи об этом, не дополняй из общих знаний или интернета без отдельного запроса.",
      "",
    ];
    if ((scope?.collectionNames?.length ?? 0) > 0) {
      lines.push("Коллекции:");
      for (const n of scope!.collectionNames!) lines.push(`- «${n}»`);
      lines.push("");
    }
    if ((scope?.documentNames?.length ?? 0) > 0) {
      lines.push("Документы:");
      for (const n of scope!.documentNames!) lines.push(`- «${n}»`);
      lines.push("");
    }
    return lines.join("\n");
  }

  if (!collections || collections.length === 0) return "";

  const nonEmpty = collections.filter((c) => c.documentsCount > 0);
  if (nonEmpty.length === 0) return "";

  const lines = [
    "## Библиотека пользователя",
    "",
    "Личный архив загруженных документов. Ищи в нём через инструмент `librarySearch`, когда вопрос касается собственных файлов пользователя, его договоров, отчётов, книг, статей, таблиц — или когда по смыслу видно, что ответ может быть в коллекции ниже.",
    "",
    "Коллекции:",
  ];

  for (const c of nonEmpty) {
    const tag = c.isDefault ? " — коллекция по умолчанию" : "";
    lines.push(`- «${c.name}» (${c.documentsCount} док.)${tag}`);
  }

  lines.push("");
  return lines.join("\n");
}
