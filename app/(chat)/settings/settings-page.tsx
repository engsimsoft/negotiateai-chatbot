"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { ArrowLeft, User, Monitor, Palette } from "lucide-react";
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
import { SidebarToggle } from "@/components/sidebar-toggle";
import { toast } from "@/components/toast";
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

type Section = "profile" | "account" | "appearance";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Профиль", icon: <User className="size-4" /> },
  { id: "account", label: "Аккаунт", icon: <Monitor className="size-4" /> },
  {
    id: "appearance",
    label: "Внешний вид",
    icon: <Palette className="size-4" />,
  },
];

export function SettingsPage() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
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
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarToggle />
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Назад
        </button>
        <h1 className="text-lg font-semibold">Настройки</h1>
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
          Информация о вас, которую используют агенты
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
            Агенты будут использовать это имя
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
            placeholder="Расскажите о себе — это поможет агентам давать более релевантные ответы"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Поможет агентам давать релевантные советы
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
