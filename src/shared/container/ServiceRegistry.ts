import { App } from 'obsidian';
import { DIContainer } from './DIContainer';
import { VocabularySettings } from '../../features/settings/ui/settings';

// Core Services
import { AddWordUseCase } from '../../core/use-cases/AddWordUseCase';
import { CreateBookUseCase } from '../../core/use-cases/CreateBookUseCase';
import { GetWordsForReviewUseCase } from '../../core/use-cases/GetWordsForReviewUseCase';
import { ReviewWordUseCase } from '../../core/use-cases/ReviewWordUseCase';

// Infrastructure Services
import { VocabularyRepositoryAdapter } from '../../infrastructure/obsidian/repositories/VocabularyRepositoryAdapter';
import { BookRepositoryAdapter } from '../../infrastructure/obsidian/repositories/BookRepositoryAdapter';
import { VocabularyDatabaseManager } from '../../infrastructure/storage/VocabularyDatabase';
import { LLMServiceAdapter } from '../../infrastructure/llm/LLMServiceAdapter';

// External Services
import { WordServiceAdapter } from '../../infrastructure/external/WordServiceAdapter';
import { TTSServiceAdapter } from '../../core/ports/services/ITTSServiceAdapter';

export class ServiceRegistry {
    static registerServices(container: DIContainer, app: App, settings: VocabularySettings): void {
        // External dependencies
        container.registerInstance('app', app);
        container.registerInstance('settings', settings);

        // Infrastructure Layer
        container.register('databaseManager', (app: App) => {
            return new VocabularyDatabaseManager(
                app,
                () => {}, // saveCallback - DI에서는 빈 함수로 처리
                settings.vocabularyFolderPath
            );
        }, {
            dependencies: ['app'],
            singleton: true
        });

        container.register('vocabularyRepository', VocabularyRepositoryAdapter, {
            dependencies: ['databaseManager']
        });

        container.register('bookRepository', BookRepositoryAdapter, {
            dependencies: ['databaseManager']
        });

        container.register('wordService', WordServiceAdapter, {
            dependencies: ['settings']
        });

        container.register('llmService', LLMServiceAdapter, {
            dependencies: ['settings']
        });

        container.register('ttsService', TTSServiceAdapter, {
            dependencies: ['settings']
        });

        // Core Use Cases
        container.register('addWordUseCase', AddWordUseCase, {
            dependencies: ['vocabularyRepository', 'bookRepository', 'wordService']
        });

        container.register('createBookUseCase', CreateBookUseCase, {
            dependencies: ['bookRepository']
        });

        container.register('getWordsForReviewUseCase', GetWordsForReviewUseCase, {
            dependencies: ['vocabularyRepository', 'bookRepository']
        });

        container.register('reviewWordUseCase', ReviewWordUseCase, {
            dependencies: ['vocabularyRepository']
        });
    }

    static updateSettings(container: DIContainer, settings: VocabularySettings): void {
        container.registerInstance('settings', settings);
        
        // 어댑터 서비스들 설정 업데이트
        if (container.has('ttsService')) {
            const ttsService = container.resolve<TTSServiceAdapter>('ttsService');
            ttsService.updateSettings(settings);
        }
        
        if (container.has('llmService')) {
            const llmService = container.resolve<LLMServiceAdapter>('llmService');
            llmService.updateSettings(settings);
        }
        
        if (container.has('wordService')) {
            const wordService = container.resolve<WordServiceAdapter>('wordService');
            wordService.updateSettings(settings);
        }
    }
}