import { Plugin } from 'obsidian';
import { VocabularySettings, DEFAULT_SETTINGS, VocabularySettingTab } from './settings';
import { VocabularyModal } from './VocabularyModal';
import { VocabularyCard } from './VocabularyCard';
import { VocabularyManagerModal } from './VocabularyManagerModal';
import { VocabularyDatabaseManager } from './VocabularyDatabase';
import { AddWordsModal } from './AddWordsModal';
import { AddBookModal } from './AddBookModal';
import { LLMService } from './LLMService';

export default class EnglishVocabularyPlugin extends Plugin {
    settings: VocabularySettings;
    databaseManager: VocabularyDatabaseManager;
    llmService: LLMService;

    async onload() {
        console.log('영어 단어 학습 플러그인이 로드되었습니다.');

        await this.loadSettings();

        // 데이터베이스 매니저 초기화 (App 인스턴스 전달)
        this.databaseManager = new VocabularyDatabaseManager(
            this.app,
            () => this.saveAllData(),
            this.settings.vocabularyFolderPath
        );
        
        // MD 파일 기반 데이터 로드
        try {
            await this.databaseManager.loadAllBooks();
        } catch (error) {
            console.error('단어장 데이터 로드 실패:', error);
            // 기존 data.json에서 마이그레이션 시도
            await this.migrateFromLegacyData();
        }

        // LLM 서비스 초기화
        this.llmService = new LLMService(this.settings);

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
        console.log('영어 단어 학습 플러그인이 언로드되었습니다.');
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
    }

    async saveSettings() {
        await this.saveAllData();
    }

    // 기존 data.json에서 MD 파일로 마이그레이션
    private async migrateFromLegacyData() {
        try {
            const savedData = await this.loadData();
            if (savedData && savedData.database && Array.isArray(savedData.database.words)) {
                console.log('기존 data.json에서 MD 파일로 마이그레이션 시작...');
                
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
                
                console.log('마이그레이션 완료');
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