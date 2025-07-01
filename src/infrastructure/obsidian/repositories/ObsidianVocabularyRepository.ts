import { App } from 'obsidian';
import { IVocabularyRepository } from '../../../core/ports/repositories/IVocabularyRepository';
import { VocabularyCard, VocabularyCardData, SearchResult } from '../../../core/entities/Vocabulary';
import { SearchOptions, Difficulty } from '../../../shared/lib/types';
import { MarkdownDatabase } from '../../storage/MarkdownDatabase';

export class ObsidianVocabularyRepository implements IVocabularyRepository {
    private words: Map<string, VocabularyCard> = new Map();
    private dataChangeCallbacks: ((cards: VocabularyCard[]) => void)[] = [];
    private markdownDb: MarkdownDatabase;

    constructor(
        private app: App,
        private vocabularyFolderPath: string = 'Vocabulary'
    ) {
        this.markdownDb = new MarkdownDatabase(app, vocabularyFolderPath);
    }

    // 기본 CRUD 작업
    async save(card: VocabularyCard): Promise<void> {
        this.words.set(card.word.toLowerCase(), card);
        await this.markdownDb.saveWordToFile(card);
        this.notifyDataChanged();
    }

    async findByWord(word: string): Promise<VocabularyCard | null> {
        const card = this.words.get(word.toLowerCase());
        return card ? this.convertToVocabularyCard(card.toPlainObject()) : null;
    }

    async findAll(): Promise<VocabularyCard[]> {
        return Array.from(this.words.values()).map(card => 
            this.convertToVocabularyCard(card.toPlainObject())
        );
    }

    async findByBookId(bookId: string): Promise<VocabularyCard[]> {
        return Array.from(this.words.values())
            .filter(card => card.bookId === bookId)
            .map(card => this.convertToVocabularyCard(card.toPlainObject()));
    }

    async update(word: string, card: VocabularyCard): Promise<void> {
        const existingCard = this.words.get(word.toLowerCase());
        if (!existingCard) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        this.words.set(word.toLowerCase(), card);
        await this.markdownDb.saveWordToFile(card);
        this.notifyDataChanged();
    }

    async delete(word: string): Promise<void> {
        const card = this.words.get(word.toLowerCase());
        if (!card) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        this.words.delete(word.toLowerCase());
        await this.markdownDb.removeWordFromFile(card);
        this.notifyDataChanged();
    }

    // 검색 기능
    async search(options: SearchOptions): Promise<SearchResult> {
        let cards = Array.from(this.words.values());

        // 텍스트 검색
        if (options.query) {
            const query = options.query.toLowerCase();
            cards = cards.filter(card => 
                card.word.toLowerCase().includes(query) ||
                card.meanings.some(meaning => meaning.toLowerCase().includes(query)) ||
                card.similarWords.some(similar => similar.toLowerCase().includes(query))
            );
        }

        // 단어장 필터
        if (options.bookId) {
            cards = cards.filter(card => card.bookId === options.bookId);
        }

        // 난이도 필터
        if (options.difficulty) {
            cards = cards.filter(card => card.difficulty === options.difficulty);
        }

        // 정렬 (기본: 단어 알파벳 순)
        cards.sort((a, b) => {
            const wordA = typeof a.word === 'string' ? a.word : '';
            const wordB = typeof b.word === 'string' ? b.word : '';
            return wordA.localeCompare(wordB);
        });

        // 페이징
        const limit = options.limit || cards.length;
        const resultCards = cards.slice(0, limit);

        return {
            cards: resultCards.map(card => this.convertToVocabularyCard(card.toPlainObject())),
            totalCount: cards.length,
            hasMore: cards.length > limit
        };
    }

    async searchByText(query: string): Promise<VocabularyCard[]> {
        const result = await this.search({ query });
        return result.cards;
    }

    // 복습 관련
    async findCardsForReview(bookId?: string): Promise<VocabularyCard[]> {
        let cards = Array.from(this.words.values());

        if (bookId) {
            cards = cards.filter(card => card.bookId === bookId);
        }

        // 복습이 필요한 카드들만 필터링
        const cardsNeedingReview = cards.filter(card => card.needsReview());

        // 우선순위 정렬 (어려운 것 우선, 오래된 것 우선)
        return cardsNeedingReview
            .sort((a, b) => {
                // 1. 난이도 우선순위
                const difficultyOrder = { 'hard': 2, 'good': 1, 'easy': 0 };
                const diffDiff = difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty];
                if (diffDiff !== 0) return diffDiff;

                // 2. 마지막 복습일이 오래된 순
                const aTime = a.lastReviewed ? new Date(a.lastReviewed).getTime() : 0;
                const bTime = b.lastReviewed ? new Date(b.lastReviewed).getTime() : 0;
                return aTime - bTime;
            })
            .map(card => this.convertToVocabularyCard(card.toPlainObject()));
    }

    async findCardsByDifficulty(difficulty: Difficulty, bookId?: string): Promise<VocabularyCard[]> {
        let cards = Array.from(this.words.values());

        if (bookId) {
            cards = cards.filter(card => card.bookId === bookId);
        }

        return cards
            .filter(card => card.difficulty === difficulty)
            .map(card => this.convertToVocabularyCard(card.toPlainObject()));
    }

    // 통계 관련
    async count(): Promise<number> {
        return this.words.size;
    }

    async countByBookId(bookId: string): Promise<number> {
        return Array.from(this.words.values())
            .filter(card => card.bookId === bookId).length;
    }

    async countByDifficulty(difficulty: Difficulty): Promise<number> {
        return Array.from(this.words.values())
            .filter(card => card.difficulty === difficulty).length;
    }

    // 배치 작업
    async saveMany(cards: VocabularyCard[]): Promise<void> {
        for (const card of cards) {
            this.words.set(card.word.toLowerCase(), card);
        }
        
        await this.markdownDb.saveManyWordsToFiles(cards);
        this.notifyDataChanged();
    }

    async deleteMany(words: string[]): Promise<void> {
        const cardsToDelete: VocabularyCard[] = [];
        
        for (const word of words) {
            const card = this.words.get(word.toLowerCase());
            if (card) {
                cardsToDelete.push(card);
                this.words.delete(word.toLowerCase());
            }
        }
        
        await this.markdownDb.removeManyWordsFromFiles(cardsToDelete);
        this.notifyDataChanged();
    }

    // 데이터 동기화
    async loadData(): Promise<void> {
        const wordsData = await this.markdownDb.loadAllWords();
        this.words.clear();
        
        for (const wordData of wordsData) {
            const card = this.convertToVocabularyCard(wordData);
            this.words.set(card.word.toLowerCase(), card);
        }
        
        this.notifyDataChanged();
    }

    async saveData(): Promise<void> {
        const cards = Array.from(this.words.values());
        await this.markdownDb.saveAllWordsToFiles(cards);
    }

    // 이벤트 관련
    onDataChanged(callback: (cards: VocabularyCard[]) => void): void {
        this.dataChangeCallbacks.push(callback);
    }

    offDataChanged(callback: (cards: VocabularyCard[]) => void): void {
        const index = this.dataChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataChangeCallbacks.splice(index, 1);
        }
    }

    // 비즈니스 로직 메서드들 (기존 VocabularyDatabase에서 이전)
    async reviewWord(word: string, difficulty: Difficulty): Promise<void> {
        const card = this.words.get(word.toLowerCase());
        if (!card) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        const reviewedCard = card.review(difficulty);
        await this.update(word, reviewedCard);
    }

    async updateWordData(word: string, partialData: Partial<VocabularyCardData>): Promise<void> {
        const card = this.words.get(word.toLowerCase());
        if (!card) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        const updatedCard = card.updateWordData(partialData);
        await this.update(word, updatedCard);
    }

    // 유틸리티 메서드
    private convertToVocabularyCard(data: VocabularyCardData): VocabularyCard {
        return new VocabularyCard(
            data.word,
            data.pronunciation,
            data.meanings,
            data.similarWords,
            data.examples,
            data.reviewCount,
            data.difficulty,
            data.lastReviewed,
            data.addedDate,
            data.bookId
        );
    }

    private notifyDataChanged(): void {
        const cards = Array.from(this.words.values());
        this.dataChangeCallbacks.forEach(callback => {
            try {
                callback(cards);
            } catch (error) {
                console.error('데이터 변경 콜백 실행 중 오류:', error);
            }
        });
    }

    // 마이그레이션 및 호환성을 위한 메서드들
    getWordsMap(): Map<string, VocabularyCard> {
        return new Map(this.words);
    }

    async migrateFromLegacyData(words: any[]): Promise<void> {
        this.words.clear();
        
        for (const wordData of words) {
            const card = this.convertToVocabularyCard(wordData);
            this.words.set(card.word.toLowerCase(), card);
        }
        
        await this.saveData();
        this.notifyDataChanged();
    }
} 