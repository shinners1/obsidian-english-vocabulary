import { VocabularyCard, SearchResult } from '../../entities/Vocabulary';
import { SearchOptions } from '../../../shared/lib/types';

export interface IVocabularyRepository {
    // 기본 CRUD 작업
    add(card: VocabularyCard): Promise<void>;
    save(card: VocabularyCard): Promise<void>;
    findByWord(word: string): Promise<VocabularyCard | null>;
    findAll(): Promise<VocabularyCard[]>;
    findByBookId(bookId: string): Promise<VocabularyCard[]>;
    update(word: string, card: VocabularyCard): Promise<void>;
    delete(word: string): Promise<void>;
    
    // 검색 기능
    search(options: SearchOptions): Promise<SearchResult>;
    searchByText(query: string): Promise<VocabularyCard[]>;
    
    // 복습 관련
    findCardsForReview(bookId?: string): Promise<VocabularyCard[]>;
    findCardsByDifficulty(difficulty: 'easy' | 'good' | 'hard', bookId?: string): Promise<VocabularyCard[]>;
    
    // 통계 관련
    count(): Promise<number>;
    countByBookId(bookId: string): Promise<number>;
    countByDifficulty(difficulty: 'easy' | 'good' | 'hard'): Promise<number>;
    
    // 배치 작업
    saveMany(cards: VocabularyCard[]): Promise<void>;
    deleteMany(words: string[]): Promise<void>;
    
    // 데이터 동기화
    loadData(): Promise<void>;
    saveData(): Promise<void>;
    
    // 이벤트 관련
    onDataChanged(callback: (cards: VocabularyCard[]) => void): void;
    offDataChanged(callback: (cards: VocabularyCard[]) => void): void;
} 