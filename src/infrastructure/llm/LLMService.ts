import { VocabularySettings } from '../../features/settings/ui/settings';
import { WordData } from '../../VocabularyCard';
import { decryptApiKey } from '../../utils';
import { retryAPICall, APIRetryPolicy } from '../../shared/RetryPolicy';
import axios from 'axios';

export interface LLMResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export interface ProgressCallback {
    (current: number, total: number, message: string): void;
}

export interface WordDetailData {
    word: string;
    pronunciation: string;
    meanings: string[];
    examples: {
        english: string;
        korean: string;
    }[];
    similarWords: string[];
}

export class LLMService {
    private settings: VocabularySettings;
    private retryPolicy: APIRetryPolicy;

    constructor(settings: VocabularySettings) {
        this.settings = settings;
        this.retryPolicy = new APIRetryPolicy({
            maxAttempts: 3,
            delayMs: 2000,
            exponentialBackoff: true
        });
    }

    // 현재 선택된 제공업체의 API 키를 가져오는 메서드
    private getCurrentApiKey(): string {
        const provider = this.settings.llmProvider;
        let encryptedKey = '';
        
        switch (provider) {
            case 'openai':
                encryptedKey = this.settings.openaiApiKey;
                break;
            case 'anthropic':
                encryptedKey = this.settings.anthropicApiKey;
                break;
            case 'google':
                encryptedKey = this.settings.googleApiKey;
                break;
        }
        
        return decryptApiKey(encryptedKey);
    }

    async testConnection(): Promise<LLMResponse> {
        try {
            const apiKey = this.getCurrentApiKey();
            if (!apiKey) {
                return { success: false, error: 'API 키가 설정되지 않았습니다.' };
            }

            const testPrompt = 'Hello, this is a test message. Please respond with "OK" if you can read this.';
            const response = await this.callLLM(testPrompt);
            
            if (response.success) {
                return { success: true, data: 'API 연결 성공' };
            } else {
                return { success: false, error: response.error || 'API 연결 실패' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getWordDetails(word: string): Promise<LLMResponse> {
        try {
            const apiKey = this.getCurrentApiKey();
            if (!apiKey) {
                return { success: false, error: 'API 키가 설정되지 않았습니다.' };
            }

            const prompt = this.createWordDetailPrompt(word);
            const response = await this.callLLM(prompt);
            
            if (response.success) {
                const parsedData = this.parseWordDetailResponse(response.data, word);
                return { success: true, data: parsedData };
            } else {
                return { success: false, error: response.error || '단어 정보를 가져오는데 실패했습니다.' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getMultipleWordDetails(words: string[], progressCallback?: ProgressCallback): Promise<LLMResponse> {
        try {
            const apiKey = this.getCurrentApiKey();
            if (!apiKey) {
                return { success: false, error: 'API 키가 설정되지 않았습니다.' };
            }

            if (words.length === 0) {
                return { success: false, error: '처리할 단어가 없습니다.' };
            }

            const BATCH_SIZE = 20;
            const allResults: WordDetailData[] = [];
            const totalBatches = Math.ceil(words.length / BATCH_SIZE);

            
            if (progressCallback) {
                progressCallback(0, words.length, `총 ${words.length}개 단어를 ${totalBatches}개 배치로 나누어 처리합니다.`);
            }

            for (let i = 0; i < words.length; i += BATCH_SIZE) {
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const batchWords = words.slice(i, i + BATCH_SIZE);
                
                
                if (progressCallback) {
                    progressCallback(i, words.length, `배치 ${batchNumber}/${totalBatches} 처리 중... (${batchWords.length}개 단어)`);
                }
                
                try {
                    const prompt = this.createMultipleWordDetailPrompt(batchWords);
                    const response = await this.callLLM(prompt);
                    
                    if (response.success) {
                        const parsedData = this.parseMultipleWordDetailResponse(response.data, batchWords);
                        allResults.push(...parsedData);
                        
                        if (progressCallback) {
                            progressCallback(i + batchWords.length, words.length, `배치 ${batchNumber} 완료: ${parsedData.length}개 단어 처리됨`);
                        }
                    } else {
                        console.error(`배치 ${batchNumber} 실패:`, response.error);
                        if (progressCallback) {
                            progressCallback(i, words.length, `배치 ${batchNumber} 실패, 개별 처리로 전환...`);
                        }
                        // 실패한 배치의 단어들을 개별적으로 처리 시도
                        const individualResults = await this.processWordsIndividually(batchWords, progressCallback, i);
                        allResults.push(...individualResults);
                    }
                } catch (error) {
                    console.error(`배치 ${batchNumber} 처리 중 오류:`, error);
                    if (progressCallback) {
                        progressCallback(i, words.length, `배치 ${batchNumber} 오류, 개별 처리로 전환...`);
                    }
                    // 오류 발생 시 개별 처리로 폴백
                    const individualResults = await this.processWordsIndividually(batchWords, progressCallback, i);
                    allResults.push(...individualResults);
                }

                // 배치 간 짧은 지연 (API 제한 방지)
                if (i + BATCH_SIZE < words.length) {
                    await this.delay(1000);
                }
            }

            if (progressCallback) {
                progressCallback(words.length, words.length, `모든 배치 처리 완료. 총 ${allResults.length}개 단어 데이터 수집됨`);
            }
            return { success: true, data: allResults };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 개별 단어 처리 (배치 실패 시 폴백)
    private async processWordsIndividually(words: string[], progressCallback?: ProgressCallback, startIndex: number = 0): Promise<WordDetailData[]> {
        const results: WordDetailData[] = [];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const currentIndex = startIndex + i;
            
            try {
                if (progressCallback) {
                    progressCallback(currentIndex, startIndex + words.length, `개별 처리: "${word}"`);
                }
                
                const response = await this.getWordDetails(word);
                if (response.success && response.data) {
                    results.push(response.data);
                } else {
                    console.warn(`단어 "${word}" 처리 실패:`, response.error);
                    // 실패한 단어에 대한 기본 데이터 생성
                    results.push({
                        word: word.toLowerCase(),
                        pronunciation: '',
                        meanings: ['처리 실패'],
                        examples: [],
                        similarWords: []
                    });
                }
                
                // 개별 처리 간 짧은 지연
                await this.delay(500);
            } catch (error) {
                console.error(`단어 "${word}" 개별 처리 중 오류:`, error);
                results.push({
                    word: word.toLowerCase(),
                    pronunciation: '',
                    meanings: ['처리 오류'],
                    examples: [],
                    similarWords: []
                });
            }
        }
        
        return results;
    }

    // 지연 함수
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private createWordDetailPrompt(word: string): string {
        return `다음 영어 단어 "${word}"에 대한 상세 정보를 JSON 형식으로 제공해주세요.

요구사항:
1. 발음기호 (IPA 형식)
2. 한글 뜻들 (여러 개일 수 있음)
3. 각 뜻별로 영어 예문과 한글 번역 (각 뜻당 2-3개의 예문 제공)
4. 유사한 영어 단어들

응답 형식:
{
  "word": "${word}",
  "pronunciation": "/발음기호/",
  "meanings": ["뜻1", "뜻2", "뜻3"],
  "examples": [
    {
      "english": "영어 예문 1",
      "korean": "한글 번역 1"
    },
    {
      "english": "영어 예문 2", 
      "korean": "한글 번역 2"
    },
    {
      "english": "영어 예문 3",
      "korean": "한글 번역 3"
    }
  ],
  "similarWords": ["유사단어1", "유사단어2", "유사단어3"]
}

JSON 형식으로만 응답해주세요. 다른 설명은 포함하지 마세요.`;
    }

    private createMultipleWordDetailPrompt(words: string[]): string {
        const wordList = words.join(', ');
        return `다음 영어 단어들에 대한 상세 정보를 정확한 JSON 형식으로 제공해주세요: ${wordList}

요구사항:
- 각 단어에 대해 발음기호 (IPA 형식), 한글 뜻들, 영어 예문과 한글 번역, 유사한 영어 단어들을 포함
- 각 뜻별로 2-3개의 예문을 제공해주세요
- JSON 형식만 응답하고 다른 설명은 포함하지 마세요
- 모든 문자열은 이중 따옴표로 감싸주세요
- 배열과 객체는 정확한 JSON 문법을 따르세요

응답 형식:
[
  {
    "word": "단어1",
    "pronunciation": "/발음기호/",
    "meanings": ["뜻1", "뜻2"],
    "examples": [
      {
        "english": "영어 예문 1",
        "korean": "한글 번역 1"
      },
      {
        "english": "영어 예문 2",
        "korean": "한글 번역 2"
      },
      {
        "english": "영어 예문 3",
        "korean": "한글 번역 3"
      }
    ],
    "similarWords": ["유사단어1", "유사단어2"]
  }
]

중요: JSON 형식만 응답하고 다른 텍스트는 포함하지 마세요.`;
    }

    private async callLLM(prompt: string): Promise<LLMResponse> {
        try {
            const provider = this.settings.llmProvider;
            
            switch (provider) {
                case 'openai':
                    return await this.callOpenAI(prompt);
                case 'anthropic':
                    return await this.callAnthropic(prompt);
                case 'google':
                    return await this.callGoogle(prompt);
                default:
                    return { success: false, error: '지원하지 않는 LLM 제공업체입니다.' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    private async callOpenAI(prompt: string): Promise<LLMResponse> {
        try {
            const response = await retryAPICall(async () => {
                    return fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.getCurrentApiKey()}`
                        },
                        body: JSON.stringify({
                            model: this.settings.llmModel,
                            messages: [
                                {
                                    role: 'user',
                                    content: prompt
                                }
                            ],
                            temperature: 0.3,
                            max_tokens: 4000
                        })
                    });
                });

            if (!response.ok) {
                const errorData = await response.json();
                return { success: false, error: errorData.error?.message || 'OpenAI API 호출 실패' };
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            
            if (!content) {
                return { success: false, error: '응답 내용이 없습니다.' };
            }

            return { success: true, data: content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    private async callAnthropic(prompt: string): Promise<LLMResponse> {
        // Node.js 환경에서만 동작하도록 처리
        if (typeof window === 'undefined' || (typeof window !== 'undefined' && (window as any)?.process?.type === 'renderer')) {
            try {
                const response = await axios.post(
                    'https://api.anthropic.com/v1/messages',
                    {
                        model: this.settings.llmModel,
                        max_tokens: 30000,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': this.getCurrentApiKey(),
                            'anthropic-version': '2023-06-01'
                        }
                    }
                );
                const content = response.data.content[0]?.text;
                if (!content) {
                    return { success: false, error: '응답 내용이 없습니다.' };
                }
                return { success: true, data: content };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            // 브라우저 환경에서는 안내 메시지 반환
            return {
                success: false,
                error: 'Anthropic API는 브라우저 환경에서 직접 호출할 수 없습니다. 데스크톱 앱(Obsidian)에서만 동작합니다.'
            };
        }
    }

    private async callGoogle(prompt: string): Promise<LLMResponse> {
        try {
            const response = await retryAPICall(async () => {
                    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.settings.llmModel}:generateContent?key=${this.getCurrentApiKey()}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        {
                                            text: prompt
                                        }
                                    ]
                                }
                            ],
                            generationConfig: {
                                temperature: 0.3,
                                maxOutputTokens: 4000
                            }
                        })
                    });
                });

            if (!response.ok) {
                const errorData = await response.json();
                return { success: false, error: errorData.error?.message || 'Google API 호출 실패' };
            }

            const data = await response.json();
            const content = data.candidates[0]?.content?.parts[0]?.text;
            
            if (!content) {
                return { success: false, error: '응답 내용이 없습니다.' };
            }

            return { success: true, data: content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    private parseWordDetailResponse(response: string, originalWord: string): WordDetailData {
        try {
            // JSON 응답에서 JSON 부분만 추출
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON 형식의 응답을 찾을 수 없습니다.');
            }

            const jsonData = JSON.parse(jsonMatch[0]);
            
            // 예문 데이터 검증 및 정리
            const validatedExamples = this.validateExamples(jsonData.examples);
            
            return {
                word: jsonData.word || originalWord,
                pronunciation: jsonData.pronunciation || '',
                meanings: jsonData.meanings || [],
                examples: validatedExamples,
                similarWords: jsonData.similarWords || []
            };
        } catch (error) {
            // JSON 파싱 실패 시 기본 데이터 반환
            return {
                word: originalWord,
                pronunciation: '',
                meanings: ['의미를 파싱할 수 없습니다.'],
                examples: [],
                similarWords: []
            };
        }
    }

    // 예문 데이터 검증 및 정리
    private validateExamples(examples: any[]): { english: string; korean: string; }[] {
        if (!Array.isArray(examples)) {
            return [];
        }

        const validatedExamples: { english: string; korean: string; }[] = [];
        
        for (const example of examples) {
            if (example && typeof example === 'object') {
                const english = example.english || example.english_text || example.text || '';
                const korean = example.korean || example.korean_text || example.translation || '';
                
                if (english.trim() && korean.trim()) {
                    validatedExamples.push({
                        english: english.trim(),
                        korean: korean.trim()
                    });
                }
            }
        }
        
        return validatedExamples;
    }

    private parseMultipleWordDetailResponse(response: string, originalWords: string[]): WordDetailData[] {
        try {
            
            // 1. 완전한 JSON 배열을 찾아보기
            let jsonMatch = response.match(/\[[\s\S]*\]/);
            
            if (!jsonMatch) {
                // 2. 완전한 배열이 없으면 개별 객체들을 찾아서 배열로 만들기
                const objectMatches = response.match(/\{[^{}]*"word"[^{}]*\}/g);
                if (objectMatches && objectMatches.length > 0) {
                    const jsonString = '[' + objectMatches.join(',') + ']';
                    try {
                        const jsonData = JSON.parse(jsonString);
                        if (Array.isArray(jsonData)) {
                            return this.processJsonData(jsonData, originalWords);
                        }
                    } catch (e) {
                        // 파싱 실패 시 무시
                    }
                }
                
                // 3. 마지막 완전한 객체까지 찾기
                const lastCompleteMatch = response.match(/\[[\s\S]*\}(?=\s*$)/);
                if (lastCompleteMatch) {
                    jsonMatch = [lastCompleteMatch[0] + ']'];
                } else {
                    throw new Error('JSON 배열을 찾을 수 없습니다.');
                }
            }

            // 4. JSON 파싱 시도 - 점진적으로 시도
            let jsonData;
            let parsedLength = 0;
            
            try {
                jsonData = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                // JSON 파싱 실패 시 점진적 파싱 시도
                
                // 5. 점진적 파싱 시도 - 완전한 객체들만 파싱
                const results = this.parseIncrementalJson(response);
                if (results.length > 0) {
                    return results;
                }
                
                // 6. JSON 복구 시도
                const fixedJson = this.fixJsonString(jsonMatch[0]);
                try {
                    jsonData = JSON.parse(fixedJson);
                } catch (secondError) {
                    throw new Error('JSON 파싱 및 복구 실패');
                }
            }
            
            if (!Array.isArray(jsonData)) {
                throw new Error('응답이 배열 형식이 아닙니다.');
            }

            return this.processJsonData(jsonData, originalWords);
            
        } catch (error) {
            console.error('여러 단어 응답 파싱 오류:', error);
            console.error('원본 응답:', response);
            
            // 오류 발생 시 빈 결과 반환
            return originalWords.map(word => ({
                word: word.toLowerCase(),
                pronunciation: '',
                meanings: [],
                examples: [],
                similarWords: []
            }));
        }
    }

    // 점진적 JSON 파싱 - 완전한 객체들만 파싱
    private parseIncrementalJson(response: string): WordDetailData[] {
        const results: WordDetailData[] = [];
        
        // 완전한 객체들을 찾기 (예문 필드 포함)
        const objectRegex = /\{[^{}]*"word"[^{}]*"pronunciation"[^{}]*"meanings"[^{}]*"examples"[^{}]*"similarWords"[^{}]*\}/g;
        let match;
        
        while ((match = objectRegex.exec(response)) !== null) {
            try {
                const objectData = JSON.parse(match[0]);
                if (objectData && objectData.word) {
                    const validatedExamples = this.validateExamples(objectData.examples);
                    
                    const wordData: WordDetailData = {
                        word: objectData.word.toLowerCase(),
                        pronunciation: objectData.pronunciation || '',
                        meanings: Array.isArray(objectData.meanings) ? objectData.meanings : [],
                        examples: validatedExamples,
                        similarWords: Array.isArray(objectData.similarWords) ? objectData.similarWords : []
                    };
                    results.push(wordData);
                }
            } catch (e) {
                // 개별 객체 파싱 실패 시 무시
                continue;
            }
        }
        
        return results;
    }

    // WordDetailData를 WordData로 변환하는 메서드
    convertToWordData(wordDetail: WordDetailData): WordData {
        return {
            word: wordDetail.word,
            pronunciation: wordDetail.pronunciation,
            meanings: wordDetail.meanings,
            similarWords: wordDetail.similarWords,
            examples: wordDetail.examples
        };
    }

    // JSON 데이터 처리
    private processJsonData(jsonData: any[], originalWords: string[]): WordDetailData[] {
        const results: WordDetailData[] = [];
        
        for (const item of jsonData) {
            if (item && typeof item === 'object' && item.word) {
                const validatedExamples = this.validateExamples(item.examples);
                
                const wordData: WordDetailData = {
                    word: item.word.toLowerCase(),
                    pronunciation: item.pronunciation || '',
                    meanings: Array.isArray(item.meanings) ? item.meanings : [],
                    examples: validatedExamples,
                    similarWords: Array.isArray(item.similarWords) ? item.similarWords : []
                };
                results.push(wordData);
            }
        }

        return results;
    }

    // JSON 문자열 복구
    private fixJsonString(jsonString: string): string {
        let fixed = jsonString;
        
        // 1. 불완전한 객체 제거 (마지막 쉼표 뒤의 불완전한 부분)
        const lastCompleteObject = fixed.match(/.*\}(?=,?\s*$)/);
        if (lastCompleteObject) {
            fixed = lastCompleteObject[0] + ']';
        }
        
        // 2. 중복된 쉼표 제거
        fixed = fixed.replace(/,\s*,/g, ',');
        
        // 3. 배열 끝의 쉼표 제거
        fixed = fixed.replace(/,\s*\]/g, ']');
        
        // 4. 객체 끝의 쉼표 제거
        fixed = fixed.replace(/,\s*\}/g, '}');
        
        // 5. 문자열 내의 이스케이프되지 않은 따옴표 처리 (lookbehind 없이)
        let result = '';
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < fixed.length; i++) {
            const char = fixed[i];
            const prevChar = i > 0 ? fixed[i - 1] : '';
            
            if (char === '"' && !escaped) {
                if (inString) {
                    // 문자열 종료
                    inString = false;
                    result += char;
                } else {
                    // 문자열 시작
                    inString = true;
                    result += char;
                }
            } else if (char === '"' && escaped) {
                // 이미 이스케이프된 따옴표
                result += char;
            } else if (char === '"' && inString && !escaped) {
                // 문자열 내부의 이스케이프되지 않은 따옴표
                result += '\\"';
            } else {
                result += char;
            }
            
            escaped = (char === '\\' && !escaped);
        }
        
        fixed = result;
        
        return fixed;
    }

} 