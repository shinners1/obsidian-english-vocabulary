import { ApiResponse, LLMProvider } from '../../../shared/lib/types';
import { WordData } from '../../entities/Vocabulary';

// LLM API 응답 타입
export interface LLMWordDetail {
    word: string;
    pronunciation: string;
    meanings: string[];
    examples: Array<{
        english: string;
        korean: string;
    }>;
    similarWords: string[];
}

// LLM 설정 타입
export interface LLMConfig {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

export interface ILLMService {
    // 기본 설정
    configure(config: LLMConfig): void;
    isConfigured(): boolean;
    getProvider(): LLMProvider;
    
    // 단어 정보 조회
    getWordDetails(word: string): Promise<ApiResponse<LLMWordDetail>>;
    getMultipleWordDetails(words: string[]): Promise<ApiResponse<LLMWordDetail[]>>;
    
    // 데이터 변환
    convertToWordData(llmDetail: LLMWordDetail): WordData;
    
    // 배치 처리
    processBatch(words: string[], batchSize?: number): Promise<ApiResponse<LLMWordDetail[]>>;
    
    // 오류 처리
    handleError(error: any): string;
    
    // 요청 제한 관리
    checkRateLimit(): Promise<boolean>;
    getRemainingRequests(): number;
    
    // 캐시 관리
    clearCache(): void;
    getCachedResult(word: string): LLMWordDetail | null;
    setCachedResult(word: string, result: LLMWordDetail): void;
} 