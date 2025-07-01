import { Modal, App, Notice } from 'obsidian';
import { IVocabularyRepository } from '../../../core/ports/IVocabularyRepository';
import { VocabularyCard } from '../../../core/entities/Vocabulary';
import { Difficulty } from '../../../shared/lib/types';

export interface VocabularyReviewModalDependencies {
    vocabularyRepository: IVocabularyRepository;
    reviewModalHeight?: number;
}

export class VocabularyReviewModal extends Modal {
    private dependencies: VocabularyReviewModalDependencies;
    private words: VocabularyCard[];
    private currentIndex = 0;
    private showAnswer = false;

    constructor(app: App, dependencies: VocabularyReviewModalDependencies, words: VocabularyCard[]) {
        super(app);
        this.dependencies = dependencies;
        this.words = words;
    }

    onOpen() {
        if (this.words.length === 0) {
            this.close();
            return;
        }

        this.showCurrentWord();
    }

    private showCurrentWord() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-learning-modal');

        // 설정된 높이를 CSS 변수로 적용
        const modalHeight = this.dependencies.reviewModalHeight || 80;
        contentEl.style.setProperty('--review-modal-height', `${modalHeight}vh`);

        const currentWord = this.words[this.currentIndex];
        
        const progressEl = contentEl.createEl('div', { cls: 'review-progress' });
        progressEl.createEl('span', { 
            text: `${this.currentIndex + 1} / ${this.words.length}`,
            cls: 'progress-text'
        });

        const cardEl = contentEl.createEl('div', { cls: 'review-card' });
        
        // 카드 삭제 버튼 (오른쪽 상단)
        const deleteButton = cardEl.createEl('button', { 
            text: '카드 삭제',
            cls: 'card-delete-button'
        });
        deleteButton.addEventListener('click', () => this.handleDeleteCard());
        
        const wordEl = cardEl.createEl('h1', { cls: 'review-word' });
        if (currentWord.pronunciation && currentWord.pronunciation.trim()) {
            wordEl.textContent = currentWord.word;
            wordEl.appendText(' ');
            wordEl.createEl('span', { 
                text: `[${currentWord.pronunciation}]`,
                cls: 'pronunciation'
            });
        } else {
            wordEl.textContent = currentWord.word;
        }

        if (!this.showAnswer) {
            if (currentWord.similarWords.length > 0) {
                const similarEl = cardEl.createEl('div', { cls: 'similar-words' });
                similarEl.createEl('p', { 
                    cls: 'similar-words-inline',
                    text: `유사한 단어들: ${currentWord.similarWords.join(', ')}`
                });
            }

            if (currentWord.examples.length > 0) {
                const examplesEl = cardEl.createEl('div', { cls: 'examples' });
                examplesEl.createEl('h3', { text: '예문들:' });
                currentWord.examples.forEach(example => {
                    examplesEl.createEl('p', { text: example.english, cls: 'example' });
                });
            }

            const checkBtn = cardEl.createEl('button', { 
                text: '정답 확인하기',
                cls: 'check-answer-button'
            });
            checkBtn.addEventListener('click', () => {
                this.showAnswer = true;
                this.showCurrentWord();
            });
        } else {
            const answerEl = cardEl.createEl('div', { cls: 'answer-section' });
            answerEl.createEl('h3', { text: '뜻:' });
            const meaningsList = answerEl.createEl('ul');
            currentWord.meanings.forEach(meaning => {
                meaningsList.createEl('li', { text: meaning });
            });

            if (currentWord.examples.length > 0) {
                answerEl.createEl('h3', { text: '예문 번역:' });
                currentWord.examples.forEach(example => {
                    answerEl.createEl('p', { text: example.korean, cls: 'translation' });
                });
            }

            this.createReviewButtons(cardEl);
        }
    }

    private createReviewButtons(container: HTMLElement) {
        const reviewSection = container.createEl('div', { cls: 'review-buttons' });
        
        const hardBtn = reviewSection.createEl('button', { text: '어려움', cls: 'review-btn hard' });
        const goodBtn = reviewSection.createEl('button', { text: '좋음', cls: 'review-btn good' });
        const easyBtn = reviewSection.createEl('button', { text: '쉬움', cls: 'review-btn easy' });

        hardBtn.addEventListener('click', () => this.handleReview('hard'));
        goodBtn.addEventListener('click', () => this.handleReview('good'));
        easyBtn.addEventListener('click', () => this.handleReview('easy'));
    }

    private async handleReview(difficulty: Difficulty) {
        const currentWord = this.words[this.currentIndex];
        
        // 복습 수행 (엔티티의 비즈니스 로직 활용)
        const reviewedWord = currentWord.review(difficulty);
        await this.dependencies.vocabularyRepository.update(reviewedWord);

        this.currentIndex++;
        this.showAnswer = false;

        if (this.currentIndex >= this.words.length) {
            this.showCompletion();
        } else {
            this.showCurrentWord();
        }
    }

    private async handleDeleteCard() {
        const currentWord = this.words[this.currentIndex];
        
        const confirmModal = new ConfirmModal(
            this.app,
            '단어 삭제',
            `"${currentWord.word}" 단어를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
            async () => {
                try {
                    await this.dependencies.vocabularyRepository.remove(currentWord.word);
                    
                    this.words.splice(this.currentIndex, 1);
                    
                    if (this.words.length === 0) {
                        this.showCompletion();
                        return;
                    }
                    
                    if (this.currentIndex >= this.words.length) {
                        this.currentIndex = this.words.length - 1;
                    }
                    
                    this.showAnswer = false;
                    this.showCurrentWord();
                    
                } catch (error) {
                    console.error('단어 삭제 중 오류 발생:', error);
                    new Notice('단어 삭제 중 오류가 발생했습니다.');
                }
            }
        );
        confirmModal.open();
    }

    private showCompletion() {
        const { contentEl } = this;
        contentEl.empty();

        const completionEl = contentEl.createEl('div', { cls: 'completion' });
        completionEl.createEl('h2', { text: '복습 완료!' });
        completionEl.createEl('p', { text: '모든 단어를 복습했습니다.' });

        const closeBtn = completionEl.createEl('button', { text: '닫기', cls: 'close-btn' });
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 확인 모달 (공통 컴포넌트로 분리 예정)
class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private onConfirm: () => void;

    constructor(app: App, title: string, message: string, onConfirm: () => void) {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('confirm-modal');

        contentEl.createEl('h2', { text: this.title, cls: 'modal-title' });
        
        const messageEl = contentEl.createEl('div', { cls: 'modal-message' });
        this.message.split('\n').forEach(line => {
            messageEl.createEl('p', { text: line });
        });

        const buttonSection = contentEl.createEl('div', { cls: 'button-section' });
        
        const confirmBtn = buttonSection.createEl('button', { 
            text: '확인',
            cls: 'confirm-button danger'
        });
        confirmBtn.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });

        const cancelBtn = buttonSection.createEl('button', { 
            text: '취소',
            cls: 'cancel-button'
        });
        cancelBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 