// 입력 검증 및 정제 유틸리티

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitized?: string;
}

// 문자열 입력 검증
export function validateString(input: string, options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    pattern?: RegExp;
    fieldName?: string;
} = {}): ValidationResult {
    const {
        minLength = 0,
        maxLength = 1000,
        allowEmpty = false,
        pattern,
        fieldName = '입력값'
    } = options;

    if (!input || input.trim().length === 0) {
        if (allowEmpty) {
            return { isValid: true, sanitized: '' };
        }
        return { isValid: false, error: `${fieldName}은(는) 필수 입력값입니다.` };
    }

    const trimmed = input.trim();

    if (trimmed.length < minLength) {
        return { 
            isValid: false, 
            error: `${fieldName}은(는) 최소 ${minLength}자 이상이어야 합니다.` 
        };
    }

    if (trimmed.length > maxLength) {
        return { 
            isValid: false, 
            error: `${fieldName}은(는) 최대 ${maxLength}자 이하여야 합니다.` 
        };
    }

    if (pattern && !pattern.test(trimmed)) {
        return { 
            isValid: false, 
            error: `${fieldName}의 형식이 올바르지 않습니다.` 
        };
    }

    return { isValid: true, sanitized: trimmed };
}

// API 키 검증
export function validateApiKey(apiKey: string, provider: string): ValidationResult {
    const validation = validateString(apiKey, {
        minLength: 10,
        maxLength: 200,
        fieldName: `${provider} API 키`
    });

    if (!validation.isValid) {
        return validation;
    }

    // 각 제공업체별 API 키 형식 검증
    const patterns = {
        openai: /^sk-[a-zA-Z0-9]{48,}$/,
        anthropic: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
        google: /^[a-zA-Z0-9_-]{39}$/
    };

    const pattern = patterns[provider.toLowerCase() as keyof typeof patterns];
    if (pattern && !pattern.test(validation.sanitized!)) {
        return {
            isValid: false,
            error: `${provider} API 키 형식이 올바르지 않습니다.`
        };
    }

    return validation;
}

// 단어 입력 검증
export function validateWord(word: string): ValidationResult {
    const validation = validateString(word, {
        minLength: 1,
        maxLength: 50,
        pattern: /^[a-zA-Z\s'-]+$/,
        fieldName: '단어'
    });

    if (!validation.isValid) {
        return validation;
    }

    // 추가 검증: 특수 문자 제한
    const sanitized = validation.sanitized!
        .replace(/[^\w\s'-]/g, '') // 허용되지 않는 특수문자 제거
        .replace(/\s+/g, ' '); // 연속된 공백을 하나로

    return { isValid: true, sanitized };
}

// 마크다운 텍스트 정제
export function sanitizeMarkdown(text: string): string {
    if (!text) return '';

    return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 스크립트 태그 제거
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '') // iframe 태그 제거
        .replace(/javascript:/gi, '') // javascript: 프로토콜 제거
        .replace(/on\w+\s*=/gi, '') // 이벤트 핸들러 제거
        .trim();
}

// URL 검증
export function validateUrl(url: string): ValidationResult {
    if (!url) {
        return { isValid: false, error: 'URL이 필요합니다.' };
    }

    try {
        const urlObj = new URL(url);
        
        // HTTPS만 허용
        if (urlObj.protocol !== 'https:') {
            return { isValid: false, error: 'HTTPS URL만 허용됩니다.' };
        }

        // 허용된 도메인 확인 (필요시)
        const allowedDomains = [
            'api.openai.com',
            'api.anthropic.com',
            'generativelanguage.googleapis.com'
        ];

        // 도메인 검증은 선택적으로 수행
        return { isValid: true, sanitized: url };
    } catch (error) {
        return { isValid: false, error: '유효하지 않은 URL 형식입니다.' };
    }
}

// 숫자 입력 검증
export function validateNumber(value: any, options: {
    min?: number;
    max?: number;
    integer?: boolean;
    fieldName?: string;
} = {}): ValidationResult {
    const { min, max, integer = false, fieldName = '숫자' } = options;

    const num = Number(value);
    
    if (isNaN(num)) {
        return { isValid: false, error: `${fieldName}은(는) 유효한 숫자여야 합니다.` };
    }

    if (integer && !Number.isInteger(num)) {
        return { isValid: false, error: `${fieldName}은(는) 정수여야 합니다.` };
    }

    if (min !== undefined && num < min) {
        return { isValid: false, error: `${fieldName}은(는) ${min} 이상이어야 합니다.` };
    }

    if (max !== undefined && num > max) {
        return { isValid: false, error: `${fieldName}은(는) ${max} 이하여야 합니다.` };
    }

    return { isValid: true, sanitized: num.toString() };
}

// 배치 검증 함수
export function validateBatch<T>(
    items: T[],
    validator: (item: T) => ValidationResult
): { valid: T[]; invalid: Array<{ item: T; error: string }> } {
    const valid: T[] = [];
    const invalid: Array<{ item: T; error: string }> = [];

    for (const item of items) {
        const result = validator(item);
        if (result.isValid) {
            valid.push(item);
        } else {
            invalid.push({ item, error: result.error || '알 수 없는 오류' });
        }
    }

    return { valid, invalid };
}