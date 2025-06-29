import { ApiResponse } from '../../../shared/lib/types';
import { WordData } from '../../entities/Vocabulary';

// 사전 API 응답 타입
export interface DictionaryResult {
    word: string;
    pronunciation?: string;
    meanings: Array<{
        partOfSpeech: string;
        definitions: Array<{
            definition: string;
            example?: string;
        }>;
    }>;
    phonetics?: Array<{
        text: string;
        audio?: string;
    }>;
}

export interface IWordService {
    // 단어 정보 조회
    getWordData(word: string): Promise<WordData>;
    lookupWord(word: string): Promise<ApiResponse<DictionaryResult>>;
    
    // 발음 정보
    getPronunciation(word: string): Promise<string>;
    
    // 검증
    validateWord(word: string): boolean;
    isEnglishWord(word: string): Promise<boolean>;
    
    // 유사 단어 추천
    getSimilarWords(word: string): Promise<string[]>;
    
    // 오류 처리
    handleError(error: any): string;
} 