import { App, TFile, TFolder, normalizePath } from 'obsidian';

export interface CacheSettings {
    languageCode: string;
    voice: string;
    speakingRate: number;
    pitch: number;
}

export interface CacheInfo {
    totalFiles: number;
    totalSize: number;
    formattedSize: string;
}

export class TTSCacheManager {
    private app: App;
    private cacheFolder = 'Vocabulary/cache/tts';
    
    constructor(app: App) {
        this.app = app;
        this.initializeCacheFolder();
    }

    private async initializeCacheFolder(): Promise<void> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.cacheFolder);
            
            if (folder instanceof TFolder) {
                return;
            }
            
            // cache/tts 폴더 생성
            await this.app.vault.createFolder(this.cacheFolder);
            
        } catch (error) {
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (!errorMessage.includes('already exists') && 
                    !errorMessage.includes('folder already exists') &&
                    !errorMessage.includes('already present')) {
                    console.warn('TTS 캐시 폴더 생성 실패:', error);
                }
            }
        }
    }

    private generateCacheKey(text: string, settings: CacheSettings, word?: string): string {
        const keyData = {
            text: text.trim().toLowerCase(),
            languageCode: settings.languageCode,
            voice: settings.voice,
            speakingRate: settings.speakingRate,
            pitch: settings.pitch
        };
        
        const keyString = JSON.stringify(keyData);
        // 간단한 해시 함수 (브라우저 환경에서 사용 가능)
        const hash = this.simpleHash(keyString);
        
        // 텍스트에서 단어 추출 (파일명에 사용할 수 있도록 정리)
        const cleanText = this.extractWordForFilename(text, word);
        
        // 파일명: 단어_해시.mp3 형식
        return `${cleanText}_${hash}.mp3`;
    }

    private extractWordForFilename(text: string, word?: string): string {
        // 텍스트를 파일명에 사용할 수 있도록 정리
        let cleanText = text.trim().toLowerCase();
        
        // 텍스트 타입 감지
        const isLongText = cleanText.length > 50 || cleanText.includes('.') || cleanText.includes(',');
        
        if (isLongText && word) {
            // 예문의 경우: "영단어_예문시작부분" 형식
            const cleanWord = this.sanitizeForFilename(word);
            const words = cleanText.split(/[\s\.,!?;:]+/).filter(w => w.length > 0);
            const examplePart = words.slice(0, 3).join('-');
            const cleanExample = this.sanitizeForFilename(examplePart);
            cleanText = `${cleanWord}_${cleanExample}`;
        } else if (isLongText) {
            // 긴 텍스트(예문)의 경우: 첫 2-3개 단어 추출
            const words = cleanText.split(/[\s\.,!?;:]+/).filter(w => w.length > 0);
            const significantWords = words.slice(0, 3).join('_');
            cleanText = significantWords;
        } else {
            // 단일 단어의 경우: 첫 번째 단어만 추출
            const firstWord = cleanText.split(/[\s\.,!?;:]+/)[0];
            cleanText = firstWord;
        }
        
        // 파일명 정리
        cleanText = this.sanitizeForFilename(cleanText);
        
        // 길이 제한 (최대 50자로 확장 - 영단어_예문 형식을 위해)
        if (cleanText.length > 50) {
            cleanText = cleanText.substring(0, 50);
            // 끝에 언더스코어나 하이픈이 있으면 제거
            cleanText = cleanText.replace(/[-_]+$/, '');
        }
        
        // 빈 문자열이면 기본값 사용
        if (cleanText.length === 0) {
            cleanText = 'tts';
        }
        
        return cleanText;
    }

    private sanitizeForFilename(text: string): string {
        // 파일명에 사용할 수 없는 문자들 제거
        let cleaned = text.replace(/[<>:"/\\|?*]/g, '');
        
        // 영문자, 숫자, 하이픈, 언더스코어만 허용
        cleaned = cleaned.replace(/[^a-z0-9\-_]/g, '');
        
        // 연속된 언더스코어나 하이픈 제거
        cleaned = cleaned.replace(/[-_]+/g, '_');
        
        // 시작과 끝의 언더스코어 제거
        cleaned = cleaned.replace(/^_+|_+$/g, '');
        
        return cleaned;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        
        return Math.abs(hash).toString(36);
    }

    private getCacheFilePath(cacheKey: string): string {
        return normalizePath(`${this.cacheFolder}/${cacheKey}`);
    }

    async getCachedAudio(text: string, settings: CacheSettings, word?: string): Promise<ArrayBuffer | null> {
        try {
            const cacheKey = this.generateCacheKey(text, settings, word);
            const filePath = this.getCacheFilePath(cacheKey);
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const arrayBuffer = await this.app.vault.readBinary(file);
                console.log(`TTS 캐시 히트: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" → ${cacheKey}`);
                return arrayBuffer;
            }
            
            return null;
        } catch (error) {
            console.warn('TTS 캐시 로드 실패:', error);
            return null;
        }
    }

    async setCachedAudio(text: string, settings: CacheSettings, base64Audio: string, word?: string): Promise<void> {
        try {
            await this.initializeCacheFolder();
            
            const cacheKey = this.generateCacheKey(text, settings, word);
            const filePath = this.getCacheFilePath(cacheKey);
            
            // Base64를 ArrayBuffer로 변환
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modifyBinary(existingFile, bytes.buffer);
            } else {
                await this.app.vault.createBinary(filePath, bytes.buffer);
            }
            
            console.log(`TTS 캐시 저장: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" → ${cacheKey}`);
        } catch (error) {
            console.error('TTS 캐시 저장 실패:', error);
        }
    }

    async getCacheInfo(): Promise<CacheInfo> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.cacheFolder);
            if (!(folder instanceof TFolder)) {
                return {
                    totalFiles: 0,
                    totalSize: 0,
                    formattedSize: '0 B'
                };
            }

            let totalFiles = 0;
            let totalSize = 0;

            for (const file of folder.children) {
                if (file instanceof TFile && file.extension === 'mp3') {
                    totalFiles++;
                    totalSize += file.stat.size;
                }
            }

            return {
                totalFiles,
                totalSize,
                formattedSize: this.formatFileSize(totalSize)
            };
        } catch (error) {
            console.error('TTS 캐시 정보 조회 실패:', error);
            return {
                totalFiles: 0,
                totalSize: 0,
                formattedSize: '0 B'
            };
        }
    }

    async clearCache(): Promise<boolean> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.cacheFolder);
            if (!(folder instanceof TFolder)) {
                return true;
            }

            const filesToDelete = folder.children.filter(file => 
                file instanceof TFile && file.extension === 'mp3'
            ) as TFile[];

            for (const file of filesToDelete) {
                await this.app.fileManager.trashFile(file);
            }

            console.log(`TTS 캐시 삭제 완료: ${filesToDelete.length}개 파일`);
            return true;
        } catch (error) {
            console.error('TTS 캐시 삭제 실패:', error);
            return false;
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 캐시 폴더 경로 업데이트
    updateCacheFolder(vocabularyFolderPath: string): void {
        this.cacheFolder = `${vocabularyFolderPath}/cache/tts`;
        this.initializeCacheFolder();
    }

    // 캐시 통계 (개발/디버깅용)
    async getCacheStats(): Promise<{
        hitCount: number;
        missCount: number;
        hitRate: number;
    }> {
        // 실제 구현시에는 메모리나 별도 파일에 통계를 저장해야 함
        // 현재는 기본값 반환
        return {
            hitCount: 0,
            missCount: 0,
            hitRate: 0
        };
    }
}