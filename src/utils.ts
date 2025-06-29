// API 키 암호화/복호화 유틸리티

// 간단한 암호화 키 (실제 프로덕션에서는 더 안전한 방법 사용 권장)
const ENCRYPTION_KEY = 'obsidian-vocabulary-plugin-key-2024';

export function encryptApiKey(apiKey: string): string {
    if (!apiKey) return '';
    
    try {
        // 간단한 XOR 암호화 (실제로는 더 안전한 방법 사용 권장)
        let encrypted = '';
        for (let i = 0; i < apiKey.length; i++) {
            const charCode = apiKey.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            encrypted += String.fromCharCode(charCode);
        }
        return btoa(encrypted); // Base64 인코딩
    } catch (error) {
        console.error('API 키 암호화 실패:', error);
        return '';
    }
}

export function decryptApiKey(encryptedApiKey: string): string {
    if (!encryptedApiKey) return '';
    
    try {
        const decoded = atob(encryptedApiKey); // Base64 디코딩
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            decrypted += String.fromCharCode(charCode);
        }
        return decrypted;
    } catch (error) {
        console.error('API 키 복호화 실패:', error);
        return '';
    }
}

// API 키를 마스킹하여 표시
export function maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);
    
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}

// 날짜 포맷팅 유틸리티
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) {
        return '없음';
    }

    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return '잘못된 날짜';
    }

    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
} 