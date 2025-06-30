import { Plugin } from 'obsidian';
import { VocabularySettings, DEFAULT_SETTINGS, VocabularySettingTab } from './features/settings/ui/settings';
import { VocabularyModal } from './features/vocabulary-learning/ui/VocabularyModal';
import { VocabularyCard } from './VocabularyCard';
import { VocabularyManagerModal } from './features/book-management/ui/VocabularyManagerModal';
import { VocabularyDatabaseManager } from './infrastructure/storage/VocabularyDatabase';
import { AddWordsModal } from './features/word-management/ui/AddWordsModal';
import { AddBookModal } from './features/book-management/ui/AddBookModal';
import { LLMService } from './infrastructure/llm/LLMService';
import { encryptApiKey, decryptApiKey } from './utils';

// DI Container
import { DIContainer, container } from './shared/container/DIContainer';
import { ServiceRegistry } from './shared/container/ServiceRegistry';

// Error Boundary
import { ErrorBoundary } from './shared/ErrorBoundary';

export default class EnglishVocabularyPlugin extends Plugin {
    settings: VocabularySettings;
    databaseManager: VocabularyDatabaseManager;
    llmService: LLMService;
    private container: DIContainer;

    async onload() {
        // Error Boundary 초기화
        const errorBoundary = ErrorBoundary.getInstance();
        errorBoundary.initialize();
        
        // 플러그인별 에러 핸들러 등록
        errorBoundary.registerHandler('VocabularyPlugin', (errorInfo) => {
            // 플러그인 관련 에러 처리 로직
            if (errorInfo.context?.includes('API')) {
                // API 관련 에러는 재시도 또는 폴백 처리
                console.warn('API 에러 감지, 폴백 모드로 전환');
            }
        });

        await this.loadSettings();

        // DI Container 초기화
        this.container = container;
        ServiceRegistry.registerServices(this.container, this.app, this.settings);

        // 데이터베이스 매니저 가져오기
        this.databaseManager = this.container.resolve<VocabularyDatabaseManager>('databaseManager');
        
        // LLM 서비스 초기화
        this.llmService = new LLMService(this.settings);
        
        // MD 파일 기반 데이터 로드
        try {
            await this.databaseManager.loadAllBooks();
        } catch (error) {
            console.error('단어장 데이터 로드 실패:', error);
            // 기존 data.json에서 마이그레이션 시도
            await this.migrateFromLegacyData();
        }

        // 설정 탭 추가
        this.addSettingTab(new VocabularySettingTab(this.app, this));

        // 명령어 추가
        this.addCommand({
            id: 'open-vocabulary-modal',
            name: '영어 단어 학습 시작',
            callback: () => {
                new VocabularyModal(this.app, this).open();
            }
        });

        // 단어장 보기 명령어 추가
        this.addCommand({
            id: 'open-vocabulary-manager',
            name: '단어장 보기',
            callback: () => {
                new VocabularyManagerModal(this.app, this).open();
            }
        });

        // 단어 추가 명령어 추가
        this.addCommand({
            id: 'add-words',
            name: '단어 추가',
            callback: () => {
                new AddWordsModal(this.app, this).open();
            }
        });

        // 리본 아이콘 추가 (책 아이콘)
        this.addRibbonIcon('book', '단어장 보기', () => {
            new VocabularyManagerModal(this.app, this).open();
        });
    }

    onunload() {
        // Error Boundary 정리
        const errorBoundary = ErrorBoundary.getInstance();
        errorBoundary.unregisterHandler('VocabularyPlugin');
        errorBoundary.cleanup();
    }

    async loadSettings() {
        // 설정 데이터만 로드 (데이터베이스 데이터와 분리)
        const data = await this.loadData();
        if (data && typeof data === 'object' && 'settings' in data) {
            // 통합된 데이터에서 설정 부분만 추출
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
        } else if (data && typeof data === 'object' && 'apiKey' in data) {
            // 기존 형식의 설정 데이터인 경우
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        } else {
            // 설정 데이터가 없는 경우 기본값 사용
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }

        // API 키 암호화 마이그레이션
        await this.migrateApiKeys();
    }

    // API 키 암호화 마이그레이션
    private async migrateApiKeys() {
        let needsSave = false;

        // llmApiKey가 평문으로 저장되어 있는지 확인하고 암호화
        if (this.settings.llmApiKey && this.isPlainTextApiKey(this.settings.llmApiKey)) {
            const plainKey = this.settings.llmApiKey;
            this.settings.llmApiKey = encryptApiKey(plainKey);
            needsSave = true;
        }

        // 다른 API 키들도 평문인지 확인하고 암호화 (기존에 암호화되지 않은 경우)
        if (this.settings.openaiApiKey && this.isPlainTextApiKey(this.settings.openaiApiKey)) {
            const plainKey = this.settings.openaiApiKey;
            this.settings.openaiApiKey = encryptApiKey(plainKey);
            needsSave = true;
        }

        if (this.settings.anthropicApiKey && this.isPlainTextApiKey(this.settings.anthropicApiKey)) {
            const plainKey = this.settings.anthropicApiKey;
            this.settings.anthropicApiKey = encryptApiKey(plainKey);
            needsSave = true;
        }

        if (this.settings.googleApiKey && this.isPlainTextApiKey(this.settings.googleApiKey)) {
            const plainKey = this.settings.googleApiKey;
            this.settings.googleApiKey = encryptApiKey(plainKey);
            needsSave = true;
        }

        // 변경사항이 있으면 저장
        if (needsSave) {
            await this.saveSettings();
        }
    }

    // API 키가 평문인지 확인하는 헬퍼 함수
    private isPlainTextApiKey(apiKey: string): boolean {
        if (!apiKey) return false;
        
        try {
            // 암호화된 키를 복호화해보고 원본과 다르면 평문으로 간주
            const decrypted = decryptApiKey(apiKey);
            return decrypted === apiKey; // 복호화 결과가 원본과 같으면 평문
        } catch (error) {
            // 복호화 실패하면 평문일 가능성이 있음
            // 일반적인 API 키 패턴 확인
            return apiKey.startsWith('sk-') || apiKey.startsWith('sk-ant-') || apiKey.startsWith('AIza') || apiKey.length > 20;
        }
    }

    async saveSettings() {
        await this.saveAllData();
        
        // LLM 서비스 업데이트
        if (this.llmService) {
            this.llmService = new LLMService(this.settings);
        }
        
        // DI Container에 설정 업데이트
        if (this.container) {
            ServiceRegistry.updateSettings(this.container, this.settings);
        }
    }

    // 기존 data.json에서 MD 파일로 마이그레이션
    private async migrateFromLegacyData() {
        try {
            const savedData = await this.loadData();
            if (savedData && savedData.database && Array.isArray(savedData.database.words)) {
                const legacyData = savedData.database;
                
                // 기존 단어들을 기본 단어장에 추가
                if (legacyData.words && legacyData.words.length > 0) {
                    for (const word of legacyData.words) {
                        try {
                            await this.databaseManager.addWord({
                                ...word,
                                bookId: 'default',
                                pronunciation: word.pronunciation || ''
                            });
                        } catch (error) {
                            console.warn(`단어 마이그레이션 실패: ${word.word}`, error);
                        }
                    }
                }
                
                // 설정 마이그레이션
                if (legacyData.settings) {
                    await this.databaseManager.updateSettings(legacyData.settings);
                }
            }
        } catch (error) {
            console.error('마이그레이션 실패:', error);
        }
    }

    // 모든 데이터 저장 (설정만 저장, 단어장 데이터는 MD 파일로 자동 저장됨)
    async saveAllData() {
        const data = {
            settings: this.settings
        };
        await this.saveData(data);
    }
}

// 타입 선언 추가
export { EnglishVocabularyPlugin, AddBookModal }; 