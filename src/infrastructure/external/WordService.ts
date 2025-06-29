import { WordData } from '../../VocabularyCard';

export class WordService {
    private apiBaseUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en';

    async getWordData(word: string): Promise<WordData> {
        try {
            // 실제 API 호출 대신 샘플 데이터를 반환
            // 실제 구현에서는 Dictionary API나 다른 API를 사용할 수 있습니다
            return this.getSampleWordData(word);
        } catch (error) {
            console.error('단어 데이터를 가져오는 중 오류:', error);
            throw new Error('단어 데이터를 가져올 수 없습니다.');
        }
    }

    private getSampleWordData(word: string): WordData {
        // 샘플 데이터 - 실제로는 API에서 가져와야 함
        const sampleData: { [key: string]: WordData } = {
            'beautiful': {
                word: 'beautiful',
                pronunciation: '/ˈbjuːtɪfəl/',
                meanings: ['아름다운', '예쁜', '훌륭한'],
                similarWords: ['pretty', 'gorgeous', 'stunning', 'attractive'],
                examples: [
                    {
                        english: 'She is a beautiful woman.',
                        korean: '그녀는 아름다운 여성입니다.'
                    },
                    {
                        english: 'The sunset was beautiful.',
                        korean: '일몰이 아름다웠습니다.'
                    },
                    {
                        english: 'What a beautiful day!',
                        korean: '정말 아름다운 하루네요!'
                    }
                ]
            },
            'happy': {
                word: 'happy',
                pronunciation: '/ˈhæpi/',
                meanings: ['행복한', '기쁜', '즐거운'],
                similarWords: ['joyful', 'cheerful', 'glad', 'pleased'],
                examples: [
                    {
                        english: 'I am happy to see you.',
                        korean: '당신을 만나서 기쁩니다.'
                    },
                    {
                        english: 'She has a happy family.',
                        korean: '그녀는 행복한 가족을 가지고 있습니다.'
                    },
                    {
                        english: 'Happy birthday!',
                        korean: '생일 축하합니다!'
                    }
                ]
            },
            'learn': {
                word: 'learn',
                pronunciation: '/lɜːrn/',
                meanings: ['배우다', '학습하다', '익히다'],
                similarWords: ['study', 'acquire', 'grasp', 'understand'],
                examples: [
                    {
                        english: 'I want to learn English.',
                        korean: '저는 영어를 배우고 싶습니다.'
                    },
                    {
                        english: 'Children learn quickly.',
                        korean: '아이들은 빨리 배웁니다.'
                    },
                    {
                        english: 'You can learn from your mistakes.',
                        korean: '실수로부터 배울 수 있습니다.'
                    }
                ]
            }
        };

        // 입력된 단어가 샘플 데이터에 있으면 반환, 없으면 기본 데이터 생성
        if (sampleData[word.toLowerCase()]) {
            return sampleData[word.toLowerCase()];
        }

        // 기본 데이터 반환
        return {
            word: word,
            pronunciation: '/pronunciation/',
            meanings: ['의미를 찾을 수 없습니다.'],
            similarWords: [],
            examples: [
                {
                    english: `This is an example sentence with the word "${word}".`,
                    korean: `"${word}"라는 단어가 포함된 예문입니다.`
                }
            ]
        };
    }

    // 실제 API 호출을 위한 메서드 (향후 구현)
    private async fetchFromAPI(word: string): Promise<any> {
        const response = await fetch(`${this.apiBaseUrl}/${word}`);
        if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
        }
        return await response.json();
    }
} 