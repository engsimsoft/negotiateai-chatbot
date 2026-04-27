import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  listAllModels,
  listPhysicalModels,
  type ModelEntry,
  type ProviderId,
} from "@/lib/ai/model-catalog";
import { readCurrentOverrides } from "@/lib/ai/model-overrides-node";
import {
  ALL_TASK_IDS,
  DEFAULT_TASK_MODELS,
  TASK_DESCRIPTIONS,
  type TaskId,
} from "@/lib/ai/task-assignments";
import { isSimplyDevMode } from "@/lib/constants";

import { DevModelsClient } from "./dev-models-client";

// ---------------------------------------------------------------------------
// ENV key status (server-side — never expose full keys to the browser)
// ---------------------------------------------------------------------------

export interface ProviderEnvStatus {
  provider: ProviderId;
  envVar: string;
  hasKey: boolean;
  last4: string | null;
  /** True for providers registered via createProviderRegistry (have LanguageModel factory). */
  isLlmRegistry: boolean;
}

const PROVIDER_ENV_MAP: Array<{
  provider: ProviderId;
  envVar: string;
  isLlmRegistry: boolean;
}> = [
  { provider: "anthropic",  envVar: "ANTHROPIC_API_KEY",            isLlmRegistry: true },
  { provider: "moonshotai", envVar: "MOONSHOT_API_KEY",             isLlmRegistry: true },
  { provider: "xai",        envVar: "XAI_API_KEY",                  isLlmRegistry: true },
  { provider: "openrouter", envVar: "OPENROUTER_API_KEY",           isLlmRegistry: true },
  { provider: "voyage",     envVar: "VOYAGE_API_KEY",               isLlmRegistry: false },
  { provider: "deepgram",   envVar: "DEEPGRAM_API_KEY",             isLlmRegistry: false },
  { provider: "perplexity", envVar: "PERPLEXITY_API_KEY",           isLlmRegistry: false },
  { provider: "google",     envVar: "GOOGLE_GENERATIVE_AI_API_KEY", isLlmRegistry: false },
];

function collectProviderEnvStatus(): ProviderEnvStatus[] {
  return PROVIDER_ENV_MAP.map(({ provider, envVar, isLlmRegistry }) => {
    const raw = process.env[envVar];
    const hasKey = typeof raw === "string" && raw.length > 0;
    return {
      provider,
      envVar,
      hasKey,
      last4: hasKey ? raw.slice(-4) : null,
      isLlmRegistry,
    };
  });
}

// ---------------------------------------------------------------------------
// Serializable data passed to client
// ---------------------------------------------------------------------------

export interface TaskRow {
  taskId: TaskId;
  description: string;
  defaultCatalogId: string;
  effectiveCatalogId: string;
  hasOverride: boolean;
}

export interface DevModelsPageData {
  tasks: TaskRow[];
  catalog: ModelEntry[];
  physicalCatalog: ModelEntry[];
  providers: ProviderEnvStatus[];
  overrides: Record<string, string>;
  overrideCount: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DevModelsPage() {
  // Dev gate: 404 in production
  if (!isSimplyDevMode) {
    notFound();
  }

  // Auth — reuse the same guard the dashboard uses
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const overrides = readCurrentOverrides();
  const tasks: TaskRow[] = ALL_TASK_IDS.map((taskId) => {
    const defaultCatalogId = DEFAULT_TASK_MODELS[taskId];
    const override = overrides[taskId];
    return {
      taskId,
      description: TASK_DESCRIPTIONS[taskId],
      defaultCatalogId,
      effectiveCatalogId: override ?? defaultCatalogId,
      hasOverride: Boolean(override),
    };
  });

  const data: DevModelsPageData = {
    tasks,
    catalog: listAllModels(),
    physicalCatalog: listPhysicalModels(),
    providers: collectProviderEnvStatus(),
    overrides,
    overrideCount: Object.keys(overrides).length,
  };

  return <DevModelsClient data={data} />;
}
