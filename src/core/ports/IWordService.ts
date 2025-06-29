export interface WordData {
    word: string;
    meaning: string;
    pronunciation?: string;
    examples?: string[];
}

export interface IWordService {
    getWordData(word: string): Promise<WordData>;
} 