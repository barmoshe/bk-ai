// @@@SNIPSTART typescript-next-oneclick-shared
export const TASK_QUEUE_NAME = 'ecommerce-oneclick';

// Centralized configuration - hardcoded, only API key from env
const env: Record<string, any> =
  typeof process !== 'undefined' && (process as any)?.env ? ((process as any).env as any) : ({} as any);

export const config = {
  // Directories (hardcoded)
  booksDataDir: './data/book',
  generatedDir: './generated',
  
  // OpenAI Models (hardcoded)
  models: {
    pages: 'gpt-4o-mini',
    layout: 'gpt-4o-mini',
    vision: 'gpt-4o-mini',
    critic: 'gpt-4o-mini',
    refine: 'gpt-4o-mini',
    image: 'gpt-image-1',
  },
  
  // Temperatures (hardcoded)
  temperatures: {
    pages: 0.8,
    layout: 0.4,
    critic: 0.3,
    refine: 0.4,
  },
  
  // Timeouts in milliseconds (hardcoded)
  timeouts: {
    pages: 45000,
    prompt: 45000,
    image: 150000, // Increased to reduce character variant timeouts and align with activity windows
  },
  
  // Feature flags (hardcoded)
  features: {
    textRefine: true,
    critic: true,
    assetPipeline: false,
    allowPlaceholder: false,
    moderation: false,
  },
  
  // Workflow options (hardcoded)
  workflow: {
    pageConcurrency: true,
    pageConcurrencyLimit: 2,
  },
  // Rate limits (env-aware)
  rateLimits: {
    openai: {
      maxRps: 5,
      burst: 10,
      concurrency: 4,
      devDisabled: true,
    },
  },
  // Agents SDK integration (feature-gated)
  agents: {
    enabled: true,
    mcpEnabled: false,
    maxSteps: 8,
    maxToolCalls: 16,
    // soft budget guardrails
    tokenBudget: 20000,
    timeBudgetMs: 120000,
  },
  
  // Image generation (hardcoded)
  image: {
    provider: 'openai_simple',
    fallbacks: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
    reduceSizes: ['1024x1024', '768x768', '512x512'],
    quality: 'hd' as 'hd' | 'standard',
    size: '1024x1024',
    variants: 3,
    retries: 4,
    initialBackoffMs: 800,
    jpegQuality: 86,
  },
  
  // Character generation (env-aware)
  character: {
    variants: env.NODE_ENV === 'production' ? 4 : 1,
  },
  
  // Cover generation (env-aware)
  cover: {
    enabled: env.ENABLE_COVER_GENERATION === 'true',
    count: env.NODE_ENV === 'production' ? 4 : 1, // 1 in dev, 4 in production
  },
  
  // Get API key from env (only dynamic value)
  getApiKey: () => env.OPENAI_API_KEY || '',
};

// Legacy imageConfig for backward compatibility
export const imageConfig = {
  composerEngine: 'hybrid' as 'hybrid' | 'canvas' | 'sharp',
  canvas: { width: 2560, height: 1440, dpi: 144 },
  objectPng: { size: '1024x1024' as '1024x1024' },
  variants: config.image.variants,
  model: config.models.image,
  retries: config.image.retries,
  initialBackoffMs: config.image.initialBackoffMs,
  timeoutMs: config.timeouts.image,
  jpegQuality: config.image.jpegQuality,
  generatedDir: config.generatedDir,
  assetPipelineEnabled: config.features.assetPipeline,
};

export type ComposerEngine = typeof imageConfig.composerEngine;
// @@@SNIPEND
