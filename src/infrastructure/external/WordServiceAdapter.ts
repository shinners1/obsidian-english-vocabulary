import { IWordService, WordDataRequest, WordDataResponse } from '../../core/ports/services/IWordService';
import { WordService } from './WordService';
import { VocabularySettings } from '../../features/settings/ui/settings';

export class WordServiceAdapter implements IWordService {
    private wordService: WordService;

    constructor(settings: VocabularySettings) {
        this.wordService = new WordService(settings);
    }

    async getWordData(request: WordDataRequest): Promise<WordDataResponse> {
        try {
            const wordData = await this.wordService.getWordData(request.word);
            
            return {
                success: true,
                data: {
                    word: wordData.word,
                    meaning: wordData.meaning,
                    pronunciation: wordData.pronunciation,
                    examples: wordData.examples || [],
                    similarWords: wordData.similarWords || []
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    updateSettings(settings: VocabularySettings): void {
        this.wordService = new WordService(settings);
    }
}