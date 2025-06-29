import { IVocabularyRepository } from '../../../core/ports/repositories/IVocabularyRepository';
import { VocabularyCard, SearchResult } from '../../../core/entities/Vocabulary';
import { SearchOptions } from '../../../shared/lib/types';
import { VocabularyDatabaseManager } from '../../storage/VocabularyDatabase';

export class VocabularyRepositoryAdapter implements IVocabularyRepository {
    constructor(private databaseManager: VocabularyDatabaseManager) {}

    async add(card: VocabularyCard): Promise<void> {
        await this.databaseManager.addWord(card);
    }

    async save(card: VocabularyCard): Promise<void> {
        await this.databaseManager.addWord(card);
    }

    async findByWord(word: string): Promise<VocabularyCard | null> {
        return this.databaseManager.getWord(word);
    }

    async findAll(): Promise<VocabularyCard[]> {
        return this.databaseManager.getAllWords();
    }

    async findByBookId(bookId: string): Promise<VocabularyCard[]> {
        return this.databaseManager.getWordsByBook(bookId);
    }

    async update(word: string, card: VocabularyCard): Promise<void> {
        await this.databaseManager.updateWord(word, card.difficulty);
    }

    async delete(word: string): Promise<void> {
        await this.databaseManager.removeWord(word);
    }

    async search(options: SearchOptions): Promise<SearchResult> {
        const allWords = await this.findAll();
        // 기본적인 검색 구현 - 나중에 고도화 가능
        const filteredWords = allWords.filter(word => 
            word.word.toLowerCase().includes(options.query?.toLowerCase() || '')
        );
        
        return {
            words: filteredWords,
            total: filteredWords.length,
            hasMore: false
        };
    }

    async searchByText(query: string): Promise<VocabularyCard[]> {
        const result = await this.search({ query });
        return result.words;
    }

    async findCardsForReview(bookId?: string): Promise<VocabularyCard[]> {
        return this.databaseManager.getWordsForReview(bookId);
    }

    async findCardsByDifficulty(difficulty: 'easy' | 'good' | 'hard', bookId?: string): Promise<VocabularyCard[]> {
        const words = bookId ? 
            await this.findByBookId(bookId) : 
            await this.findAll();
        
        return words.filter(word => word.difficulty === difficulty);
    }

    async count(): Promise<number> {
        const words = await this.findAll();
        return words.length;
    }

    async countByBookId(bookId: string): Promise<number> {
        const words = await this.findByBookId(bookId);
        return words.length;
    }

    async countByDifficulty(difficulty: 'easy' | 'good' | 'hard'): Promise<number> {
        const words = await this.findCardsByDifficulty(difficulty);
        return words.length;
    }

    async saveMany(cards: VocabularyCard[]): Promise<void> {
        for (const card of cards) {
            await this.add(card);
        }
    }

    async deleteMany(words: string[]): Promise<void> {
        for (const word of words) {
            await this.delete(word);
        }
    }

    async loadData(): Promise<void> {
        await this.databaseManager.loadAllBooks();
    }

    async saveData(): Promise<void> {
        await this.databaseManager.saveAllData();
    }

    onDataChanged(callback: (cards: VocabularyCard[]) => void): void {
        // 이벤트 리스너 구현 - 나중에 EventEmitter 패턴으로 구현
        // 현재는 빈 구현
    }

    offDataChanged(callback: (cards: VocabularyCard[]) => void): void {
        // 이벤트 리스너 제거 구현
        // 현재는 빈 구현
    }
}