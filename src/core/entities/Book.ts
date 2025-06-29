// 단어장 엔티티
export class Book {
    constructor(
        public readonly id: string,
        public name: string,
        public description: string,
        public readonly createdAt: string,
        public updatedAt: string,
        public wordCount: number,
        public readonly isDefault: boolean
    ) {}

    // 팩토리 메서드: 새 단어장 생성
    static create(name: string, description: string = '', isDefault: boolean = false): Book {
        const now = new Date().toISOString();
        const id = isDefault ? 'default' : Book.generateId();
        
        return new Book(
            id,
            name,
            description,
            now,
            now,
            0,
            isDefault
        );
    }

    // 팩토리 메서드: 기본 단어장 생성
    static createDefault(): Book {
        return Book.create('기본 단어장', '기본 단어장입니다.', true);
    }

    // 비즈니스 로직: 단어장 정보 업데이트
    updateInfo(name?: string, description?: string): Book {
        return new Book(
            this.id,
            name ?? this.name,
            description ?? this.description,
            this.createdAt,
            new Date().toISOString(),
            this.wordCount,
            this.isDefault
        );
    }

    // 비즈니스 로직: 단어 수 증가
    incrementWordCount(): Book {
        return new Book(
            this.id,
            this.name,
            this.description,
            this.createdAt,
            new Date().toISOString(),
            this.wordCount + 1,
            this.isDefault
        );
    }

    // 비즈니스 로직: 단어 수 감소
    decrementWordCount(): Book {
        return new Book(
            this.id,
            this.name,
            this.description,
            this.createdAt,
            new Date().toISOString(),
            Math.max(0, this.wordCount - 1),
            this.isDefault
        );
    }

    // 비즈니스 로직: 단어 수 재설정
    updateWordCount(count: number): Book {
        return new Book(
            this.id,
            this.name,
            this.description,
            this.createdAt,
            new Date().toISOString(),
            Math.max(0, count),
            this.isDefault
        );
    }

    // 비즈니스 로직: 삭제 가능 여부 확인
    canBeDeleted(): boolean {
        return !this.isDefault;
    }

    // 비즈니스 로직: 단어장이 비어있는지 확인
    isEmpty(): boolean {
        return this.wordCount === 0;
    }

    // 검증 로직
    validate(): string[] {
        const errors: string[] = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('단어장 이름이 필요합니다.');
        }
        
        if (this.name.trim().length > 100) {
            errors.push('단어장 이름은 100자를 초과할 수 없습니다.');
        }
        
        if (this.description.length > 500) {
            errors.push('단어장 설명은 500자를 초과할 수 없습니다.');
        }
        
        if (this.wordCount < 0) {
            errors.push('단어 수는 0 이상이어야 합니다.');
        }
        
        return errors;
    }

    // 데이터 직렬화를 위한 메서드
    toPlainObject(): BookData {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            wordCount: this.wordCount,
            isDefault: this.isDefault
        };
    }

    // 비즈니스 로직: 생성일로부터 경과 일수 계산
    getDaysFromCreation(): number {
        const createdDate = new Date(this.createdAt);
        const now = new Date();
        return Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 비즈니스 로직: 마지막 업데이트로부터 경과 일수 계산
    getDaysFromLastUpdate(): number {
        const updatedDate = new Date(this.updatedAt);
        const now = new Date();
        return Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // ID 생성 유틸리티
    private static generateId(): string {
        return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 데이터 전송용 인터페이스 (기존 호환성 유지)
export interface BookData {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    wordCount: number;
    isDefault: boolean;
}

// 단어장 통계 인터페이스
export interface BookStatistics {
    book: Book;
    totalWords: number;
    wordsByDifficulty: {
        easy: number;
        good: number;
        hard: number;
    };
    averageReviewCount: number;
    lastActivityDate: string | null;
    completionPercentage: number;
}

// 단어장 목록 옵션
export interface BookListOptions {
    includeEmpty?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'wordCount';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
} 