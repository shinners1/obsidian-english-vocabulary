// 플러그인 설정 상수 및 구성

export interface PluginConfig {
    // API 관련 설정
    api: {
        timeouts: {
            default: number;
            llm: number;
            tts: number;
        };
        retries: {
            maxAttempts: number;
            delayMs: number;
            exponentialBackoff: boolean;
        };
        rateLimiting: {
            requestsPerMinute: number;
            burstLimit: number;
        };
    };

    // 배치 처리 설정
    batch: {
        defaultSize: number;
        maxSize: number;
        delayBetweenBatches: number;
        maxConcurrentBatches: number;
    };

    // 오디오 관련 설정
    audio: {
        maxPoolSize: number;
        autoCleanupTimeoutMs: number;
        maxDurationMs: number;
    };

    // 데이터베이스 설정
    database: {
        autoSaveInterval: number;
        backupEnabled: boolean;
        maxFileSize: number;
        compressionEnabled: boolean;
    };

    // 학습 알고리즘 설정
    learning: {
        spaced_repetition: {
            initialInterval: number;
            easyBonus: number;
            hardPenalty: number;
            maxInterval: number;
            minInterval: number;
        };
        load_balancing: {
            maxDailyReviews: number;
            fuzzingPercentage: number;
            distributionWindow: number;
        };
    };

    // UI 설정
    ui: {
        animationDuration: number;
        progressUpdateInterval: number;
        notificationTimeout: number;
        modalCloseDelay: number;
    };

    // 보안 설정
    security: {
        apiKeyEncryption: {
            iterations: number;
            keyLength: number;
            saltLength: number;
        };
        sessionTimeout: number;
        maxLoginAttempts: number;
    };
}

// 기본 설정
export const DEFAULT_CONFIG: PluginConfig = {
    api: {
        timeouts: {
            default: 30000,    // 30초
            llm: 60000,        // 60초
            tts: 15000,        // 15초
        },
        retries: {
            maxAttempts: 3,
            delayMs: 1000,
            exponentialBackoff: true,
        },
        rateLimiting: {
            requestsPerMinute: 60,
            burstLimit: 10,
        },
    },

    batch: {
        defaultSize: 5,
        maxSize: 20,
        delayBetweenBatches: 200,
        maxConcurrentBatches: 3,
    },

    audio: {
        maxPoolSize: 10,
        autoCleanupTimeoutMs: 30000,  // 30초
        maxDurationMs: 300000,        // 5분
    },

    database: {
        autoSaveInterval: 5000,       // 5초
        backupEnabled: true,
        maxFileSize: 10485760,        // 10MB
        compressionEnabled: false,
    },

    learning: {
        spaced_repetition: {
            initialInterval: 1,        // 1일
            easyBonus: 1.3,
            hardPenalty: 0.8,
            maxInterval: 365,          // 1년
            minInterval: 1,            // 1일
        },
        load_balancing: {
            maxDailyReviews: 100,
            fuzzingPercentage: 5,
            distributionWindow: 7,     // 7일
        },
    },

    ui: {
        animationDuration: 300,       // 300ms
        progressUpdateInterval: 100,  // 100ms
        notificationTimeout: 5000,    // 5초
        modalCloseDelay: 500,         // 500ms
    },

    security: {
        apiKeyEncryption: {
            iterations: 10000,
            keyLength: 32,
            saltLength: 16,
        },
        sessionTimeout: 3600000,      // 1시간
        maxLoginAttempts: 5,
    },
};

// 환경별 설정
export const DEVELOPMENT_CONFIG: Partial<PluginConfig> = {
    api: {
        timeouts: {
            default: 10000,
            llm: 20000,
            tts: 5000,
        },
        retries: {
            maxAttempts: 1,
            delayMs: 500,
            exponentialBackoff: false,
        },
    },
    batch: {
        defaultSize: 2,
        maxSize: 5,
        delayBetweenBatches: 100,
    },
    database: {
        autoSaveInterval: 1000,
        backupEnabled: false,
    },
};

export const PRODUCTION_CONFIG: Partial<PluginConfig> = {
    api: {
        retries: {
            maxAttempts: 5,
            delayMs: 2000,
            exponentialBackoff: true,
        },
    },
    batch: {
        defaultSize: 10,
        maxSize: 50,
        delayBetweenBatches: 500,
    },
    database: {
        autoSaveInterval: 10000,
        backupEnabled: true,
        compressionEnabled: true,
    },
};

// 설정 관리 클래스
export class ConfigManager {
    private static instance: ConfigManager;
    private config: PluginConfig;

    private constructor() {
        this.config = this.mergeConfigs(DEFAULT_CONFIG, this.getEnvironmentConfig());
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    getConfig(): PluginConfig {
        return { ...this.config };
    }

    getValue<T>(path: string): T {
        return this.getNestedValue(this.config, path);
    }

    updateConfig(updates: Partial<PluginConfig>): void {
        this.config = this.mergeConfigs(this.config, updates);
    }

    private getEnvironmentConfig(): Partial<PluginConfig> {
        // 개발 환경 감지 (간단한 휴리스틱)
        const isDevelopment = 
            process?.env?.NODE_ENV === 'development' ||
            window.location?.hostname === 'localhost' ||
            navigator.userAgent.includes('Development');

        return isDevelopment ? DEVELOPMENT_CONFIG : PRODUCTION_CONFIG;
    }

    private mergeConfigs(base: PluginConfig, override: Partial<PluginConfig>): PluginConfig {
        const result = { ...base };
        
        for (const [key, value] of Object.entries(override)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key as keyof PluginConfig] = {
                    ...result[key as keyof PluginConfig],
                    ...value
                } as any;
            } else {
                result[key as keyof PluginConfig] = value as any;
            }
        }
        
        return result;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}

// 편의 함수들
export function getConfig(): PluginConfig {
    return ConfigManager.getInstance().getConfig();
}

export function getConfigValue<T>(path: string): T {
    return ConfigManager.getInstance().getValue<T>(path);
}

export function updateConfig(updates: Partial<PluginConfig>): void {
    ConfigManager.getInstance().updateConfig(updates);
}

// 타입 안전한 설정 접근을 위한 상수들
export const CONFIG_PATHS = {
    API_TIMEOUT_DEFAULT: 'api.timeouts.default',
    API_TIMEOUT_LLM: 'api.timeouts.llm',
    API_TIMEOUT_TTS: 'api.timeouts.tts',
    API_RETRY_MAX_ATTEMPTS: 'api.retries.maxAttempts',
    API_RETRY_DELAY: 'api.retries.delayMs',
    BATCH_DEFAULT_SIZE: 'batch.defaultSize',
    BATCH_MAX_SIZE: 'batch.maxSize',
    BATCH_DELAY: 'batch.delayBetweenBatches',
    AUDIO_MAX_POOL_SIZE: 'audio.maxPoolSize',
    AUDIO_CLEANUP_TIMEOUT: 'audio.autoCleanupTimeoutMs',
    LEARNING_INITIAL_INTERVAL: 'learning.spaced_repetition.initialInterval',
    LEARNING_EASY_BONUS: 'learning.spaced_repetition.easyBonus',
    LEARNING_HARD_PENALTY: 'learning.spaced_repetition.hardPenalty',
    UI_ANIMATION_DURATION: 'ui.animationDuration',
    UI_NOTIFICATION_TIMEOUT: 'ui.notificationTimeout',
} as const;