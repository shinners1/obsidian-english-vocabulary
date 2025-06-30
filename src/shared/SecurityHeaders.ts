// 보안 헤더 및 CSP 설정

export interface SecurityConfig {
    enableCSP: boolean;
    enableSecureHeaders: boolean;
    allowedDomains: string[];
    httpsOnly: boolean;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    enableCSP: true,
    enableSecureHeaders: true,
    allowedDomains: [
        'api.openai.com',
        'api.anthropic.com', 
        'texttospeech.googleapis.com',
        'localhost' // 개발용
    ],
    httpsOnly: true
};

export class SecurityHeaderManager {
    private config: SecurityConfig;

    constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
        this.config = config;
    }

    // Content Security Policy 생성
    generateCSP(): string {
        const allowedDomains = this.config.allowedDomains
            .map(domain => this.config.httpsOnly && domain !== 'localhost' ? `https://${domain}` : domain)
            .join(' ');

        return [
            "default-src 'self'",
            `connect-src 'self' ${allowedDomains}`,
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "media-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ');
    }

    // 안전한 fetch 옵션 생성
    getSecureFetchOptions(url: string): RequestInit {
        const options: RequestInit = {
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit', // 쿠키 전송 방지
        };

        // HTTPS 전용 모드일 때 HTTP URL 검증
        if (this.config.httpsOnly && url.startsWith('http://') && !url.includes('localhost')) {
            throw new Error('HTTPS 전용 모드에서는 HTTP URL을 사용할 수 없습니다: ' + url);
        }

        // 허용된 도메인 검증
        const urlObj = new URL(url);
        const isAllowedDomain = this.config.allowedDomains.some(domain => 
            urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );

        if (!isAllowedDomain) {
            throw new Error('허용되지 않은 도메인입니다: ' + urlObj.hostname);
        }

        return options;
    }

    // URL 검증
    validateUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            
            // 프로토콜 검증
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }

            // HTTPS 전용 모드 검증
            if (this.config.httpsOnly && urlObj.protocol === 'http:' && urlObj.hostname !== 'localhost') {
                return false;
            }

            // 도메인 허용 목록 검증
            const isAllowedDomain = this.config.allowedDomains.some(domain => 
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );

            return isAllowedDomain;
        } catch {
            return false;
        }
    }

    // 보안 권고사항 체크
    checkSecurityRecommendations(): string[] {
        const warnings: string[] = [];

        if (!this.config.enableCSP) {
            warnings.push('Content Security Policy가 비활성화되어 있습니다.');
        }

        if (!this.config.httpsOnly) {
            warnings.push('HTTPS 전용 모드가 비활성화되어 있습니다.');
        }

        if (this.config.allowedDomains.includes('*')) {
            warnings.push('모든 도메인이 허용되어 있습니다. 보안 위험이 있습니다.');
        }

        return warnings;
    }
}

// 기본 인스턴스
export const securityManager = new SecurityHeaderManager();