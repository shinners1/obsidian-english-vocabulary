import { App, TFile } from 'obsidian';
import { IBookRepository } from '../../../core/ports/repositories/IBookRepository';
import { Book, BookData, BookStatistics, BookListOptions } from '../../../core/entities/Book';
import { Statistics } from '../../../shared/lib/types';
import { MarkdownDatabase } from '../../storage/MarkdownDatabase';

export class ObsidianBookRepository implements IBookRepository {
    private books: Map<string, Book> = new Map();
    private currentBookId: string = 'default';
    private dataChangeCallbacks: ((books: Book[]) => void)[] = [];
    private currentBookCallbacks: ((book: Book | null) => void)[] = [];
    private markdownDb: MarkdownDatabase;

    constructor(
        private app: App,
        private vocabularyFolderPath: string = 'Vocabulary'
    ) {
        this.markdownDb = new MarkdownDatabase(app, vocabularyFolderPath);
        this.initializeDefaultBook();
    }

    // 기본 CRUD 작업
    async save(book: Book): Promise<void> {
        this.books.set(book.id, book);
        await this.markdownDb.saveBookToFile(book);
        this.notifyDataChanged();
    }

    async findById(id: string): Promise<Book | null> {
        const book = this.books.get(id);
        return book ? this.convertToBook(book.toPlainObject()) : null;
    }

    async findAll(options?: BookListOptions): Promise<Book[]> {
        let books = Array.from(this.books.values());

        // 빈 단어장 필터링
        if (options?.includeEmpty === false) {
            books = books.filter(book => book.wordCount > 0);
        }

        // 정렬
        if (options?.sortBy) {
            books.sort((a, b) => {
                const multiplier = options.sortOrder === 'desc' ? -1 : 1;
                
                switch (options.sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name) * multiplier;
                    case 'createdAt':
                        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
                    case 'updatedAt':
                        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * multiplier;
                    case 'wordCount':
                        return (a.wordCount - b.wordCount) * multiplier;
                    default:
                        return 0;
                }
            });
        }

        // 페이징
        if (options?.offset !== undefined || options?.limit !== undefined) {
            const start = options.offset || 0;
            const end = options.limit ? start + options.limit : undefined;
            books = books.slice(start, end);
        }

        return books.map(book => this.convertToBook(book.toPlainObject()));
    }

    async update(id: string, book: Book): Promise<void> {
        const existingBook = this.books.get(id);
        if (!existingBook) {
            throw new Error(`단어장 "${id}"를 찾을 수 없습니다.`);
        }

        this.books.set(id, book);
        await this.markdownDb.saveBookToFile(book);
        this.notifyDataChanged();
        
        // 현재 선택된 단어장이 업데이트된 경우
        if (id === this.currentBookId) {
            this.notifyCurrentBookChanged();
        }
    }

    async delete(id: string): Promise<void> {
        const book = this.books.get(id);
        if (!book) {
            throw new Error(`단어장 "${id}"를 찾을 수 없습니다.`);
        }

        if (!book.canBeDeleted()) {
            throw new Error('기본 단어장은 삭제할 수 없습니다.');
        }

        this.books.delete(id);
        await this.markdownDb.deleteBookFile(id);
        this.notifyDataChanged();

        // 삭제된 단어장이 현재 선택된 단어장인 경우 기본값으로 변경
        if (id === this.currentBookId) {
            this.currentBookId = 'default';
            this.notifyCurrentBookChanged();
        }
    }

    // 특별 검색
    async findDefault(): Promise<Book | null> {
        return this.findById('default');
    }

    async findByName(name: string): Promise<Book | null> {
        for (const book of this.books.values()) {
            if (book.name === name) {
                return this.convertToBook(book.toPlainObject());
            }
        }
        return null;
    }

    async exists(id: string): Promise<boolean> {
        return this.books.has(id);
    }

    // 통계 관련
    async count(): Promise<number> {
        return this.books.size;
    }

    async getStatistics(bookId: string): Promise<BookStatistics | null> {
        const book = this.books.get(bookId);
        if (!book) {
            return null;
        }

        // 여기서는 임시로 기본 통계 반환 (나중에 VocabularyRepository와 연동)
        return {
            book: this.convertToBook(book.toPlainObject()),
            totalWords: book.wordCount,
            wordsByDifficulty: {
                easy: 0,
                good: 0,
                hard: 0
            },
            averageReviewCount: 0,
            lastActivityDate: null,
            completionPercentage: 0
        };
    }

    async getAllStatistics(): Promise<BookStatistics[]> {
        const statistics: BookStatistics[] = [];
        
        for (const book of this.books.values()) {
            const stats = await this.getStatistics(book.id);
            if (stats) {
                statistics.push(stats);
            }
        }

        return statistics;
    }

    // 현재 선택된 단어장
    async getCurrentBook(): Promise<Book | null> {
        return this.findById(this.currentBookId);
    }

    async setCurrentBook(bookId: string): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`단어장 "${bookId}"를 찾을 수 없습니다.`);
        }

        this.currentBookId = bookId;
        this.notifyCurrentBookChanged();
        await this.saveSettings();
    }

    // 데이터 동기화
    async loadData(): Promise<void> {
        const booksData = await this.markdownDb.loadAllBooks();
        this.books.clear();

        for (const bookData of booksData) {
            const book = this.convertToBook(bookData);
            this.books.set(book.id, book);
        }

        // 기본 단어장이 없으면 생성
        if (!this.books.has('default')) {
            await this.initializeDefaultBook();
        }

        this.notifyDataChanged();
    }

    async saveData(): Promise<void> {
        for (const book of this.books.values()) {
            await this.markdownDb.saveBookToFile(book);
        }
    }

    // 유효성 검사
    async validateBookName(name: string, excludeId?: string): Promise<boolean> {
        for (const [id, book] of this.books) {
            if (id !== excludeId && book.name === name) {
                return false; // 이름 중복
            }
        }
        return true;
    }

    // 이벤트 관련
    onDataChanged(callback: (books: Book[]) => void): void {
        this.dataChangeCallbacks.push(callback);
    }

    offDataChanged(callback: (books: Book[]) => void): void {
        const index = this.dataChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataChangeCallbacks.splice(index, 1);
        }
    }

    onCurrentBookChanged(callback: (book: Book | null) => void): void {
        this.currentBookCallbacks.push(callback);
    }

    offCurrentBookChanged(callback: (book: Book | null) => void): void {
        const index = this.currentBookCallbacks.indexOf(callback);
        if (index > -1) {
            this.currentBookCallbacks.splice(index, 1);
        }
    }

    // 비즈니스 로직 메서드들 (기존 VocabularyDatabase에서 이전)
    async createBook(name: string, description: string = ''): Promise<Book> {
        // 이름 중복 확인
        const isValidName = await this.validateBookName(name);
        if (!isValidName) {
            throw new Error(`"${name}" 이름의 단어장이 이미 존재합니다.`);
        }

        const book = Book.create(name, description);
        await this.save(book);
        return book;
    }

    async updateBookInfo(bookId: string, name?: string, description?: string): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`단어장 "${bookId}"를 찾을 수 없습니다.`);
        }

        // 이름 중복 확인 (변경하는 경우)
        if (name && name !== book.name) {
            const isValidName = await this.validateBookName(name, bookId);
            if (!isValidName) {
                throw new Error(`"${name}" 이름의 단어장이 이미 존재합니다.`);
            }
        }

        const updatedBook = book.updateInfo(name, description);
        await this.update(bookId, updatedBook);
    }

    async incrementWordCount(bookId: string): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`단어장 "${bookId}"를 찾을 수 없습니다.`);
        }

        const updatedBook = book.incrementWordCount();
        await this.update(bookId, updatedBook);
    }

    async decrementWordCount(bookId: string): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`단어장 "${bookId}"를 찾을 수 없습니다.`);
        }

        const updatedBook = book.decrementWordCount();
        await this.update(bookId, updatedBook);
    }

    async updateWordCount(bookId: string, count: number): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`단어장 "${bookId}"를 찾을 수 없습니다.`);
        }

        const updatedBook = book.updateWordCount(count);
        await this.update(bookId, updatedBook);
    }

    // 유틸리티 메서드
    private convertToBook(data: BookData): Book {
        return new Book(
            data.id,
            data.name,
            data.description,
            data.createdAt,
            data.updatedAt,
            data.wordCount,
            data.isDefault
        );
    }

    private notifyDataChanged(): void {
        const books = Array.from(this.books.values());
        this.dataChangeCallbacks.forEach(callback => {
            try {
                callback(books);
            } catch (error) {
                console.error('데이터 변경 콜백 실행 중 오류:', error);
            }
        });
    }

    private notifyCurrentBookChanged(): void {
        const currentBook = this.books.get(this.currentBookId) || null;
        this.currentBookCallbacks.forEach(callback => {
            try {
                callback(currentBook);
            } catch (error) {
                console.error('현재 단어장 변경 콜백 실행 중 오류:', error);
            }
        });
    }

    private async initializeDefaultBook(): Promise<void> {
        if (!this.books.has('default')) {
            const defaultBook = Book.createDefault();
            this.books.set('default', defaultBook);
            await this.markdownDb.saveBookToFile(defaultBook);
        }
    }

    private async saveSettings(): Promise<void> {
        // 설정 저장 로직 (나중에 Settings Service와 연동)
        try {
            const settingsPath = `${this.vocabularyFolderPath}/settings.json`;
            const settings = {
                currentBookId: this.currentBookId,
                lastUpdated: new Date().toISOString()
            };
            
            const existingFile = this.app.vault.getAbstractFileByPath(settingsPath);
            const content = JSON.stringify(settings, null, 2);
            
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                await this.app.vault.create(settingsPath, content);
            }
        } catch (error) {
            console.error('설정 저장 실패:', error);
        }
    }

    // 마이그레이션 및 호환성을 위한 메서드들
    getBooksMap(): Map<string, Book> {
        return new Map(this.books);
    }

    async migrateFromLegacyData(books: any[]): Promise<void> {
        this.books.clear();
        
        for (const bookData of books) {
            const book = this.convertToBook(bookData);
            this.books.set(book.id, book);
        }
        
        await this.saveData();
        this.notifyDataChanged();
    }

    getCurrentBookId(): string {
        return this.currentBookId;
    }

    setCurrentBookId(bookId: string): void {
        this.currentBookId = bookId;
    }
} 