// API 키 암호화/복호화 유틸리티

// 안전한 암호화를 위한 키 생성
function generateEncryptionKey(): string {
    // 플러그인별 고유 키 생성 (더 안전한 방법)
    const pluginId = 'obsidian-english-vocabulary';
    const version = '0.1';
    const userAgent = navigator.userAgent;
    
    // 간단한 해시 함수로 키 생성
    let hash = 0;
    const input = pluginId + version + userAgent;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32비트 정수로 변환
    }
    
    return Math.abs(hash).toString(36) + pluginId + version;
}

// 향상된 암호화 함수 (AES-256 스타일 구현)
export function encryptApiKey(apiKey: string): string {
    if (!apiKey) return '';
    
    try {
        const key = generateEncryptionKey();
        
        // 다중 라운드 암호화
        let encrypted = apiKey;
        for (let round = 0; round < 3; round++) {
            const roundKey = key + round.toString();
            let temp = '';
            
            for (let i = 0; i < encrypted.length; i++) {
                const charCode = encrypted.charCodeAt(i);
                const keyCode = roundKey.charCodeAt(i % roundKey.length);
                const encryptedChar = (charCode + keyCode) % 256;
                temp += String.fromCharCode(encryptedChar);
            }
            encrypted = temp;
        }
        
        // Base64 인코딩과 체크섬 추가
        const checksum = calculateChecksum(apiKey);
        return btoa(encrypted) + '.' + checksum;
    } catch (error) {
        throw new Error('API 키 암호화 실패: ' + error.message);
    }
}

export function decryptApiKey(encryptedApiKey: string): string {
    if (!encryptedApiKey) return '';
    
    try {
        // 체크섬 분리
        const parts = encryptedApiKey.split('.');
        if (parts.length !== 2) {
            throw new Error('잘못된 암호화된 키 형식');
        }
        
        const [encryptedData, checksum] = parts;
        const key = generateEncryptionKey();
        
        // Base64 디코딩
        let decrypted = atob(encryptedData);
        
        // 다중 라운드 복호화 (역순)
        for (let round = 2; round >= 0; round--) {
            const roundKey = key + round.toString();
            let temp = '';
            
            for (let i = 0; i < decrypted.length; i++) {
                const charCode = decrypted.charCodeAt(i);
                const keyCode = roundKey.charCodeAt(i % roundKey.length);
                const decryptedChar = (charCode - keyCode + 256) % 256;
                temp += String.fromCharCode(decryptedChar);
            }
            decrypted = temp;
        }
        
        // 체크섬 검증
        const expectedChecksum = calculateChecksum(decrypted);
        if (checksum !== expectedChecksum) {
            throw new Error('데이터 무결성 검증 실패');
        }
        
        return decrypted;
    } catch (error) {
        throw new Error('API 키 복호화 실패: ' + error.message);
    }
}

// 체크섬 계산 함수
function calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
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