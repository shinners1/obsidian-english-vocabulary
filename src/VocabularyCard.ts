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

import { ScheduleInfo } from './core/algorithms/SpacedRepetitionAlgorithm';

export interface VocabularyCard extends WordData {
    reviewCount: number;
    difficulty: 'none' | 'easy' | 'good' | 'hard';
    lastReviewed: string | null;
    addedDate: string;
    bookId: string;
    // Spaced Repetition 정보
    scheduleInfo?: ScheduleInfo;
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