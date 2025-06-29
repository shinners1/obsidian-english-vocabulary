export interface WordData {
    word: string;
    pronunciation: string;
    meanings: string[];
    similarWords: string[];
    examples: {
        english: string;
        korean: string;
    }[];
}

export interface VocabularyCard extends WordData {
    reviewCount: number;
    difficulty: 'easy' | 'good' | 'hard';
    lastReviewed: string | null;
    addedDate: string;
    bookId: string;
}

export interface Book {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    wordCount: number;
    isDefault: boolean;
} 