import { Book, BookStatistics, BookListOptions } from '../../entities/Book';

export interface IBookRepository {
    // 기본 CRUD 작업
    save(book: Book): Promise<void>;
    findById(id: string): Promise<Book | null>;
    findAll(options?: BookListOptions): Promise<Book[]>;
    update(id: string, book: Book): Promise<void>;
    delete(id: string): Promise<void>;
    
    // 특별 검색
    findDefault(): Promise<Book | null>;
    findByName(name: string): Promise<Book | null>;
    exists(id: string): Promise<boolean>;
    
    // 통계 관련
    count(): Promise<number>;
    getStatistics(bookId: string): Promise<BookStatistics | null>;
    getAllStatistics(): Promise<BookStatistics[]>;
    
    // 현재 선택된 단어장
    getCurrentBook(): Promise<Book | null>;
    setCurrentBook(bookId: string): Promise<void>;
    
    // 데이터 동기화
    loadData(): Promise<void>;
    saveData(): Promise<void>;
    
    // 유효성 검사
    validateBookName(name: string, excludeId?: string): Promise<boolean>;
    
    // 이벤트 관련
    onDataChanged(callback: (books: Book[]) => void): void;
    offDataChanged(callback: (books: Book[]) => void): void;
    onCurrentBookChanged(callback: (book: Book | null) => void): void;
    offCurrentBookChanged(callback: (book: Book | null) => void): void;
} 