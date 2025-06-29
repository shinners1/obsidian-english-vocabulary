import { ILLMService, WordDataRequest, WordDataResponse } from '../../core/ports/services/ILLMService';
import { LLMService } from './LLMService';
import { VocabularySettings } from '../../features/settings/ui/settings';

export class LLMServiceAdapter implements ILLMService {
    private llmService: LLMService;

    constructor(settings: VocabularySettings) {
        this.llmService = new LLMService(settings);
    }

    async getWordData(request: WordDataRequest): Promise<WordDataResponse> {
        try {
            const wordInfo = await this.llmService.getWordInfo(request.word);
            
            return {
                success: true,
                data: {
                    word: wordInfo.word,
                    meaning: wordInfo.meanings,
                    pronunciation: wordInfo.pronunciation,
                    examples: wordInfo.examples,
                    similarWords: wordInfo.similarWords
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    async testConnection(): Promise<{ success: boolean; error?: string }> {
        return await this.llmService.testConnection();
    }

    updateSettings(settings: VocabularySettings): void {
        this.llmService = new LLMService(settings);
    }
}