// 보안 로거 - 민감한 정보를 자동으로 마스킹하는 로깅 유틸리티

interface LogLevel {
    ERROR: 'error';
    WARN: 'warn';
    INFO: 'info';
    DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
    ERROR: 'error',
    WARN: 'warn', 
    INFO: 'info',
    DEBUG: 'debug'
};

// 민감한 정보 패턴
const SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{32,}/g,           // OpenAI API 키
    /sk-ant-[a-zA-Z0-9-_]{95}/g,      // Anthropic API 키
    /AIza[a-zA-Z0-9-_]{35}/g,         // Google API 키
    /[a-zA-Z0-9]{32,}/g,              // 일반적인 긴 토큰
    /"apiKey":\s*"[^"]+"/g,           // JSON의 API 키
    /"password":\s*"[^"]+"/g,         // JSON의 패스워드
    /"token":\s*"[^"]+"/g,            // JSON의 토큰
];

class SecureLogger {
    private static instance: SecureLogger;
    private isDevelopment = process.env.NODE_ENV === 'development';

    private constructor() {}

    static getInstance(): SecureLogger {
        if (!SecureLogger.instance) {
            SecureLogger.instance = new SecureLogger();
        }
        return SecureLogger.instance;
    }

    // 민감한 정보를 마스킹하는 함수
    private sanitizeMessage(message: any): string {
        let sanitized = typeof message === 'object' ? JSON.stringify(message) : String(message);
        
        SENSITIVE_PATTERNS.forEach(pattern => {
            sanitized = sanitized.replace(pattern, (match) => {
                // API 키의 첫 4자리와 마지막 4자리만 보여주고 나머지는 마스킹
                if (match.length > 8) {
                    return match.substring(0, 4) + '*'.repeat(match.length - 8) + match.substring(match.length - 4);
                }
                return '*'.repeat(match.length);
            });
        });

        return sanitized;
    }

    // 안전한 로깅 메서드들
    error(message: any, ...args: any[]): void {
        const sanitizedMessage = this.sanitizeMessage(message);
        const sanitizedArgs = args.map(arg => this.sanitizeMessage(arg));
        console.error(`[SECURE] ${sanitizedMessage}`, ...sanitizedArgs);
    }

    warn(message: any, ...args: any[]): void {
        const sanitizedMessage = this.sanitizeMessage(message);
        const sanitizedArgs = args.map(arg => this.sanitizeMessage(arg));
        console.warn(`[SECURE] ${sanitizedMessage}`, ...sanitizedArgs);
    }

    info(message: any, ...args: any[]): void {
        const sanitizedMessage = this.sanitizeMessage(message);
        const sanitizedArgs = args.map(arg => this.sanitizeMessage(arg));
        console.info(`[SECURE] ${sanitizedMessage}`, ...sanitizedArgs);
    }

    debug(message: any, ...args: any[]): void {
        // 개발 환경에서만 디버그 로그 출력
        if (this.isDevelopment) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = args.map(arg => this.sanitizeMessage(arg));
            console.debug(`[SECURE-DEBUG] ${sanitizedMessage}`, ...sanitizedArgs);
        }
    }

    // 개발자용 상세 로그 (민감한 정보 포함, 개발 환경에서만)
    devLog(message: any, ...args: any[]): void {
        if (this.isDevelopment) {
            console.log(`[DEV-ONLY] ${message}`, ...args);
        }
    }
}

// 싱글톤 인스턴스 내보내기
export const secureLogger = SecureLogger.getInstance();

// 편의 함수들
export const logError = (message: any, ...args: any[]) => secureLogger.error(message, ...args);
export const logWarn = (message: any, ...args: any[]) => secureLogger.warn(message, ...args);
export const logInfo = (message: any, ...args: any[]) => secureLogger.info(message, ...args);
export const logDebug = (message: any, ...args: any[]) => secureLogger.debug(message, ...args);