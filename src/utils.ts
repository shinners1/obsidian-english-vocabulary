// API 키 암호화/복호화 유틸리티 (Web Crypto API 사용)

// 안전한 암호화를 위한 키 생성
async function generateEncryptionKey(): Promise<CryptoKey> {
    // 사용자별 고유 정보를 기반으로 키 생성
    const pluginId = 'obsidian-english-vocabulary';
    const version = '0.1';
    const userAgent = navigator.userAgent;
    const timestamp = Date.now().toString();
    
    // 키 재료 생성
    const keyMaterial = pluginId + version + userAgent + timestamp;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);
    
    // Web Crypto API를 사용한 안전한 키 도출
    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    // PBKDF2로 강력한 키 도출
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('obsidian-vocabulary-salt-2024'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    
    return derivedKey;
}

// Web Crypto API를 사용한 안전한 암호화
export async function encryptApiKey(apiKey: string): Promise<string> {
    if (!apiKey) return '';
    
    try {
        const key = await generateEncryptionKey();
        const encoder = new TextEncoder();
        const data = encoder.encode(apiKey);
        
        // 랜덤 IV 생성
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // AES-GCM 암호화
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        
        // IV와 암호화된 데이터를 결합하여 Base64 인코딩
        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);
        
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        throw new Error('API 키 암호화 실패: ' + (error as Error).message);
    }
}

export async function decryptApiKey(encryptedApiKey: string): Promise<string> {
    if (!encryptedApiKey) return '';
    
    try {
        const key = await generateEncryptionKey();
        
        // Base64 디코딩
        const combined = new Uint8Array(
            atob(encryptedApiKey)
                .split('')
                .map(char => char.charCodeAt(0))
        );
        
        // IV와 암호화된 데이터 분리
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        // AES-GCM 복호화
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        throw new Error('API 키 복호화 실패: ' + (error as Error).message);
    }
}

// 동기식 호환성을 위한 래퍼 함수들
export function encryptApiKeySync(apiKey: string): string {
    if (!apiKey) return '';
    
    // 비동기 함수를 동기적으로 사용하기 위한 폴백
    // 실제로는 비동기 버전을 사용하는 것을 권장
    try {
        // 간단한 XOR 암호화 (호환성용)
        const key = 'obsidian-vocab-temp-key-2024';
        let encrypted = '';
        for (let i = 0; i < apiKey.length; i++) {
            const charCode = apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            encrypted += String.fromCharCode(charCode);
        }
        return btoa(encrypted);
    } catch (error) {
        console.error('동기 암호화 실패:', error);
        return '';
    }
}

export function decryptApiKeySync(encryptedApiKey: string): string {
    if (!encryptedApiKey) return '';
    
    try {
        const key = 'obsidian-vocab-temp-key-2024';
        const decoded = atob(encryptedApiKey);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            decrypted += String.fromCharCode(charCode);
        }
        return decrypted;
    } catch (error) {
        console.error('동기 복호화 실패:', error);
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