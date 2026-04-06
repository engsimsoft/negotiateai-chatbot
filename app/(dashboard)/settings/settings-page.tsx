"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { ArrowLeft, User, Monitor, Palette, Link, Loader2, Users, ChevronRight, Brain } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast";
import { UserMenu } from "@/components/user-menu";
import { MemorySection } from "@/components/settings/memory-section";
import { fetcher } from "@/lib/utils";

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  pronouns: string | null;
  occupation: string | null;
  bio: string | null;
  theme: string | null;
}

const OCCUPATION_OPTIONS = [
  "Маркетинг и реклама",
  "IT и разработка",
  "Продажи",
  "HR и рекрутинг",
  "Финансы",
  "Юриспруденция",
  "Образование",
  "Медиа и контент",
  "Консалтинг",
  "E-commerce",
  "Производство",
  "Другое",
];

type Section = "profile" | "account" | "connections" | "memory" | "appearance";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Профиль", icon: <User className="size-4" /> },
  { id: "account", label: "Аккаунт", icon: <Monitor className="size-4" /> },
  {
    id: "connections",
    label: "Подключения",
    icon: <Link className="size-4" />,
  },
  {
    id: "memory",
    label: "Память",
    icon: <Brain className="size-4" />,
  },
  {
    id: "appearance",
    label: "Внешний вид",
    icon: <Palette className="size-4" />,
  },
];

export function SettingsPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { data: profile, mutate } = useSWR<UserProfile>(
    "/api/user/profile",
    fetcher
  );

  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("вы");
  const [occupation, setOccupation] = useState("");
  const [bio, setBio] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("system");

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setPronouns(profile.pronouns || "вы");
      setOccupation(profile.occupation || "");
      setBio(profile.bio || "");
      setSelectedTheme(profile.theme || "system");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || null,
          pronouns,
          occupation: occupation || null,
          bio: bio || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      await mutate();
      toast({ type: "success", description: "Профиль сохранён" });
    } catch {
      toast({ type: "error", description: "Ошибка при сохранении" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = async (value: string) => {
    setSelectedTheme(value);
    setTheme(value);

    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
      await mutate();
    } catch {
      // Theme already applied locally via setTheme
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </button>
        <h1 className="text-lg font-semibold">Настройки</h1>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar navigation */}
            <nav className="flex md:flex-col gap-1 md:w-48 md:shrink-0">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    activeSection === section.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>

            {/* Content area */}
            <div className="flex-1 min-w-0">
              {activeSection === "profile" && (
                <ProfileSection
                  displayName={displayName}
                  setDisplayName={setDisplayName}
                  pronouns={pronouns}
                  setPronouns={setPronouns}
                  occupation={occupation}
                  setOccupation={setOccupation}
                  bio={bio}
                  setBio={setBio}
                  isSaving={isSaving}
                  onSave={handleSaveProfile}
                />
              )}

              {activeSection === "account" && (
                <AccountSection email={profile?.email || ""} />
              )}

              {activeSection === "connections" && <ConnectionsSection />}

              {activeSection === "memory" && <MemorySection />}

              {activeSection === "appearance" && (
                <AppearanceSection
                  selectedTheme={selectedTheme}
                  onThemeChange={handleThemeChange}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileSection({
  displayName,
  setDisplayName,
  pronouns,
  setPronouns,
  occupation,
  setOccupation,
  bio,
  setBio,
  isSaving,
  onSave,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  pronouns: string;
  setPronouns: (v: string) => void;
  occupation: string;
  setOccupation: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Профиль</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Информация о вас для персонализации
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Как к вам обращаться</Label>
          <Input
            id="displayName"
            placeholder="Например: Владимир"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Это имя будет использоваться в приветствиях и ответах
          </p>
        </div>

        <div className="space-y-2">
          <Label>Обращение</Label>
          <RadioGroup
            value={pronouns}
            onValueChange={setPronouns}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ты" id="pronouns-ty" />
              <Label htmlFor="pronouns-ty" className="font-normal cursor-pointer">
                На &quot;ты&quot;
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="вы" id="pronouns-vy" />
              <Label htmlFor="pronouns-vy" className="font-normal cursor-pointer">
                На &quot;вы&quot;
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">Сфера деятельности</Label>
          <Select value={occupation} onValueChange={setOccupation}>
            <SelectTrigger id="occupation">
              <SelectValue placeholder="Выберите сферу" />
            </SelectTrigger>
            <SelectContent>
              {OCCUPATION_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">О себе</Label>
          <Textarea
            id="bio"
            placeholder="Расскажите о себе — это поможет давать более релевантные ответы"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Поможет давать релевантные советы
          </p>
        </div>
      </div>

      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

function AccountSection({ email }: { email: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Аккаунт</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Настройки вашего аккаунта
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled />
        </div>

        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Смена пароля и удаление аккаунта будут доступны в следующих обновлениях.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ТЗ-TG3: Telegram connection section
// ============================================================================

interface TelegramStatus {
  connected: boolean;
  username?: string;
  firstName?: string;
  linkedAt?: string;
  isActive?: boolean;
}

function ConnectionsSection() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) {
        const data: TelegramStatus = await res.json();
        setStatus(data);
        return data;
      }
    } catch {
      // silently fail
    }
    return null;
  };

  useEffect(() => {
    fetchStatus().finally(() => setIsLoading(false));
  }, []);

  // Polling after link generation
  useEffect(() => {
    if (!isPolling) return;

    const startTime = Date.now();
    const maxDuration = 2 * 60 * 1000; // 2 minutes

    const interval = setInterval(async () => {
      if (Date.now() - startTime > maxDuration) {
        clearInterval(interval);
        setIsPolling(false);
        setLinkUrl(null);
        return;
      }

      const data = await fetchStatus();
      if (data?.connected) {
        clearInterval(interval);
        setIsPolling(false);
        setLinkUrl(null);
        toast({ type: "success", description: "Telegram подключён" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling]);

  const handleConnect = async () => {
    setIsLinking(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate link");

      const data = await res.json();
      setLinkUrl(data.linkUrl);
      window.open(data.linkUrl, "_blank");
      setIsPolling(true);
    } catch {
      toast({ type: "error", description: "Не удалось создать ссылку" });
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsUnlinking(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unlink");

      setStatus({ connected: false });
      setLinkUrl(null);
      toast({ type: "success", description: "Telegram отключён" });
    } catch {
      toast({ type: "error", description: "Не удалось отключить" });
    } finally {
      setIsUnlinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Подключения</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Внешние сервисы
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Подключения</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Внешние сервисы
        </p>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#2AABEE]/10">
            <svg viewBox="0 0 24 24" className="size-5 text-[#2AABEE]" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Telegram</h3>
            {status?.connected ? (
              <p className="text-xs text-muted-foreground">
                {status.username ? `@${status.username}` : status.firstName || "Подключён"}
                {status.linkedAt && (
                  <> · {new Date(status.linkedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Доставка брифингов и уведомления
              </p>
            )}
          </div>

          {status?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isUnlinking}
            >
              {isUnlinking ? "Отключение..." : "Отключить"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isLinking || isPolling}
            >
              {isLinking ? "Создание ссылки..." : isPolling ? "Ожидание..." : "Подключить"}
            </Button>
          )}
        </div>

        {/* QR code + link after generating */}
        {linkUrl && !status?.connected && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Отсканируйте QR-код камерой телефона или нажмите кнопку выше.
            </p>
            <div className="flex justify-center">
              <div className="rounded-lg border bg-white p-3">
                <QRCodeSVG value={linkUrl} size={160} />
              </div>
            </div>
            {isPolling && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                Ожидание подключения...
              </p>
            )}
          </div>
        )}

        {status?.connected && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Бот доставляет утренний брифинг в Telegram. Управление доставкой — в настройках брифинга.
            </p>
          </div>
        )}
      </div>

      {/* ТЗ-TG5: Link to /groups */}
      {status?.connected && <GroupsLink />}
    </div>
  );
}

function GroupsLink() {
  const { data } = useSWR<{ groups: { id: string; isActive: boolean }[] }>(
    "/api/telegram/groups",
    (url: string) => fetch(url).then((r) => r.json()),
  );

  const activeCount = data?.groups?.filter((g) => g.isActive).length ?? 0;
  const totalCount = data?.groups?.length ?? 0;

  if (!data) return null;

  return (
    <NextLink
      href="/groups"
      className="flex items-center justify-between rounded-md border p-4 transition-colors hover:bg-muted/60"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Users className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Группы Telegram</h3>
          <p className="text-xs text-muted-foreground">
            {totalCount === 0
              ? "Нет подключённых групп"
              : `${activeCount} ${activeCount === 1 ? "группа" : activeCount >= 2 && activeCount <= 4 ? "группы" : "групп"} подключено`}
          </p>
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </NextLink>
  );
}

function AppearanceSection({
  selectedTheme,
  onThemeChange,
}: {
  selectedTheme: string;
  onThemeChange: (value: string) => void;
}) {
  const themes = [
    { value: "light", label: "Светлая", description: "Светлая тема оформления" },
    { value: "dark", label: "Тёмная", description: "Тёмная тема оформления" },
    { value: "system", label: "Системная", description: "Следовать настройкам системы" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Внешний вид</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Настройте тему оформления
        </p>
      </div>

      <div className="space-y-2">
        <Label>Тема</Label>
        <RadioGroup
          value={selectedTheme}
          onValueChange={onThemeChange}
          className="grid gap-3"
        >
          {themes.map((theme) => (
            <div
              key={theme.value}
              className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onThemeChange(theme.value)}
            >
              <RadioGroupItem value={theme.value} id={`theme-${theme.value}`} />
              <div>
                <Label
                  htmlFor={`theme-${theme.value}`}
                  className="font-medium cursor-pointer"
                >
                  {theme.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {theme.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
