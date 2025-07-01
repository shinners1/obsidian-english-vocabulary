import { requestUrl } from 'obsidian';
import { ILLMService, LLMConfig, LLMWordDetail } from '../../core/ports/services/ILLMService';
import { ApiResponse } from '../../shared/lib/types';
import { WordData } from '../../core/entities/Vocabulary';

export class OpenAIService implements ILLMService {
    private config: LLMConfig | null = null;
    private cache = new Map<string, LLMWordDetail>();
    private requestCount = 0;
    private maxRequests = 3000; // OpenAI API 제한

    configure(config: LLMConfig): void {
        this.config = config;
    }

    isConfigured(): boolean {
        return this.config !== null && !!this.config.apiKey;
    }

    getProvider(): 'openai' | 'anthropic' | 'google' {
        return 'openai';
    }

    async getWordDetails(word: string): Promise<ApiResponse<LLMWordDetail>> {
        if (!this.isConfigured()) {
            return { success: false, error: 'OpenAI API가 설정되지 않았습니다.' };
        }

        // 캐시 확인
        const cachedResult = this.getCachedResult(word);
        if (cachedResult) {
            return { success: true, data: cachedResult };
        }

        try {
            const prompt = this.createWordDetailPrompt(word);
            const response = await this.callOpenAI(prompt);
            
            if (response.success && response.data) {
                const parsedData = this.parseWordDetailResponse(response.data, word);
                this.setCachedResult(word, parsedData);
                return { success: true, data: parsedData };
            } else {
                return { success: false, error: response.error || '단어 정보를 가져오는데 실패했습니다.' };
            }
        } catch (error) {
            return { success: false, error: this.handleError(error) };
        }
    }

    async getMultipleWordDetails(words: string[]): Promise<ApiResponse<LLMWordDetail[]>> {
        if (!this.isConfigured()) {
            return { success: false, error: 'OpenAI API가 설정되지 않았습니다.' };
        }

        try {
            const results: LLMWordDetail[] = [];
            const BATCH_SIZE = 20;
            
            for (let i = 0; i < words.length; i += BATCH_SIZE) {
                const batchWords = words.slice(i, i + BATCH_SIZE);
                const batchResult = await this.processBatch(batchWords, BATCH_SIZE);
                
                if (batchResult.success && batchResult.data) {
                    results.push(...batchResult.data);
                } else {
                    // 배치 실패 시 개별 처리
                    const individualResults = await this.processWordsIndividually(batchWords);
                    results.push(...individualResults);
                }
                
                // API 제한 방지를 위한 지연
                if (i + BATCH_SIZE < words.length) {
                    await this.delay(1000);
                }
            }
            
            return { success: true, data: results };
        } catch (error) {
            return { success: false, error: this.handleError(error) };
        }
    }

    convertToWordData(llmDetail: LLMWordDetail): WordData {
        return {
            word: llmDetail.word,
            pronunciation: llmDetail.pronunciation,
            meanings: llmDetail.meanings,
            similarWords: llmDetail.similarWords,
            examples: llmDetail.examples
        };
    }

    async processBatch(words: string[], batchSize: number = 20): Promise<ApiResponse<LLMWordDetail[]>> {
        try {
            const prompt = this.createMultipleWordDetailPrompt(words);
            const response = await this.callOpenAI(prompt);
            
            if (response.success && response.data) {
                const parsedData = this.parseMultipleWordDetailResponse(response.data, words);
                return { success: true, data: parsedData };
            } else {
                return { success: false, error: response.error };
            }
        } catch (error) {
            return { success: false, error: this.handleError(error) };
        }
    }

    handleError(error: any): string {
        if (error.status) {
            // requestUrl error with status
            const status = error.status;
            let errorMessage = '알 수 없는 오류';
            
            try {
                const errorData = JSON.parse(error.text || '{}');
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                // JSON parsing failed, use default message
            }
            
            switch (status) {
                case 401:
                    return 'OpenAI API 키가 유효하지 않습니다.';
                case 429:
                    return 'OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
                case 500:
                    return 'OpenAI 서버 내부 오류가 발생했습니다.';
                default:
                    return `OpenAI API 오류 (${status}): ${errorMessage}`;
            }
        } else if (error.message && error.message.includes('network')) {
            return 'OpenAI API 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        } else {
            return error.message || '알 수 없는 오류가 발생했습니다.';
        }
    }

    async checkRateLimit(): Promise<boolean> {
        return this.requestCount < this.maxRequests;
    }

    getRemainingRequests(): number {
        return Math.max(0, this.maxRequests - this.requestCount);
    }

    clearCache(): void {
        this.cache.clear();
    }

    getCachedResult(word: string): LLMWordDetail | null {
        return this.cache.get(word.toLowerCase()) || null;
    }

    setCachedResult(word: string, result: LLMWordDetail): void {
        this.cache.set(word.toLowerCase(), result);
    }

    // OpenAI 특화 메서드들
    private async callOpenAI(prompt: string): Promise<ApiResponse<string>> {
        if (!this.config) {
            return { success: false, error: 'OpenAI 설정이 없습니다.' };
        }

        try {
            this.requestCount++;
            
            const response = await requestUrl({
                url: 'https://api.openai.com/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful English vocabulary assistant. Provide accurate word definitions, pronunciations, examples, and similar words in JSON format.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: this.config.maxTokens || 2000,
                    temperature: this.config.temperature || 0.7
                })
            });

            if (response.status >= 400) {
                const errorData = JSON.parse(response.text);
                return { success: false, error: errorData.error?.message || 'OpenAI API 호출 실패' };
            }

            const data = JSON.parse(response.text);
            const content = data.choices[0]?.message?.content;
            if (!content) {
                return { success: false, error: 'OpenAI API에서 응답을 받지 못했습니다.' };
            }

            return { success: true, data: content };
        } catch (error) {
            return { success: false, error: this.handleError(error) };
        }
    }

    private createWordDetailPrompt(word: string): string {
        return `Please provide detailed information about the English word "${word}" in the following JSON format:

{
  "word": "${word}",
  "pronunciation": "IPA pronunciation (e.g., /ˈwɔːtər/)",
  "meanings": ["meaning1 in Korean", "meaning2 in Korean", "..."],
  "examples": [
    {
      "english": "English example sentence",
      "korean": "Korean translation"
    }
  ],
  "similarWords": ["similar1", "similar2", "..."]
}

Requirements:
- Provide Korean translations for meanings
- Include 2-3 practical example sentences with Korean translations
- Suggest 3-5 similar or related words
- Use proper IPA pronunciation notation
- Return only valid JSON without any additional text or formatting`;
    }

    private createMultipleWordDetailPrompt(words: string[]): string {
        return `Please provide detailed information about the following English words in JSON array format:

Words: ${words.join(', ')}

Return an array of objects with this structure:
[
  {
    "word": "word1",
    "pronunciation": "IPA pronunciation",
    "meanings": ["Korean meaning1", "Korean meaning2"],
    "examples": [
      {
        "english": "English example",
        "korean": "Korean translation"
      }
    ],
    "similarWords": ["similar1", "similar2"]
  }
]

Requirements:
- Provide Korean translations for all meanings
- Include 2-3 example sentences with Korean translations per word
- Suggest 3-5 similar words per word
- Use proper IPA pronunciation notation
- Return only valid JSON array without any additional text`;
    }

    private parseWordDetailResponse(response: string, originalWord: string): LLMWordDetail {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON 형식을 찾을 수 없습니다.');
            }

            const data = JSON.parse(jsonMatch[0]);
            
            return {
                word: originalWord.toLowerCase(),
                pronunciation: data.pronunciation || '',
                meanings: Array.isArray(data.meanings) ? data.meanings : ['정보 없음'],
                examples: this.validateExamples(data.examples || []),
                similarWords: Array.isArray(data.similarWords) ? data.similarWords : []
            };
        } catch (error) {
            console.error('OpenAI 응답 파싱 오류:', error);
            return {
                word: originalWord.toLowerCase(),
                pronunciation: '',
                meanings: ['파싱 실패'],
                examples: [],
                similarWords: []
            };
        }
    }

    private parseMultipleWordDetailResponse(response: string, originalWords: string[]): LLMWordDetail[] {
        try {
            const arrayMatch = response.match(/\[[\s\S]*\]/);
            if (!arrayMatch) {
                throw new Error('JSON 배열을 찾을 수 없습니다.');
            }

            const data = JSON.parse(arrayMatch[0]);
            if (!Array.isArray(data)) {
                throw new Error('응답이 배열 형식이 아닙니다.');
            }

            return data.map((item: any, index: number) => ({
                word: (originalWords[index] || item.word || '').toLowerCase(),
                pronunciation: item.pronunciation || '',
                meanings: Array.isArray(item.meanings) ? item.meanings : ['정보 없음'],
                examples: this.validateExamples(item.examples || []),
                similarWords: Array.isArray(item.similarWords) ? item.similarWords : []
            }));
        } catch (error) {
            console.error('OpenAI 다중 응답 파싱 오류:', error);
            return originalWords.map(word => ({
                word: word.toLowerCase(),
                pronunciation: '',
                meanings: ['파싱 실패'],
                examples: [],
                similarWords: []
            }));
        }
    }

    private validateExamples(examples: any[]): { english: string; korean: string; }[] {
        return examples
            .filter(ex => ex && typeof ex.english === 'string' && typeof ex.korean === 'string')
            .map(ex => ({
                english: ex.english.trim(),
                korean: ex.korean.trim()
            }))
            .slice(0, 3); // 최대 3개로 제한
    }

    private async processWordsIndividually(words: string[]): Promise<LLMWordDetail[]> {
        const results: LLMWordDetail[] = [];
        
        for (const word of words) {
            try {
                const response = await this.getWordDetails(word);
                if (response.success && response.data) {
                    results.push(response.data);
                } else {
                    results.push({
                        word: word.toLowerCase(),
                        pronunciation: '',
                        meanings: ['처리 실패'],
                        examples: [],
                        similarWords: []
                    });
                }
                
                // 개별 요청 간 지연
                await this.delay(500);
            } catch (error) {
                console.error(`OpenAI 개별 처리 실패: ${word}`, error);
                results.push({
                    word: word.toLowerCase(),
                    pronunciation: '',
                    meanings: ['오류 발생'],
                    examples: [],
                    similarWords: []
                });
            }
        }
        
        return results;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 