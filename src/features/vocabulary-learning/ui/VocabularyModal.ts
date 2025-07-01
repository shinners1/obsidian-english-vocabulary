import { Modal, App, Notice } from 'obsidian';
import EnglishVocabularyPlugin from '../../../main';
import { VocabularyCard } from '../../../VocabularyCard';
import { TTSService } from '../../../infrastructure/tts/TTSInterface';
import { TTSServiceFactory } from '../../../infrastructure/tts/TTSService';
import { SpacedRepetitionService, ReviewSession } from '../../../core/services/SpacedRepetitionService';
import { ReviewResponse } from '../../../core/algorithms/SpacedRepetitionAlgorithm';

export class VocabularyModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    currentCardIndex = 0;
    cards: VocabularyCard[] = [];
    showAnswer = false;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private ttsService: TTSService;
    private spacedRepetitionService: SpacedRepetitionService;
    private currentSession: ReviewSession | null = null;

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app);
        this.plugin = plugin;
        this.ttsService = TTSServiceFactory.createTTSService(app, plugin.settings);
        this.spacedRepetitionService = new SpacedRepetitionService();
    }

    onOpen() {
        // 저장된 모든 단어 가져오기
        const allCards = this.plugin.databaseManager.getAllWords();
        
        // Spaced Repetition: 복습이 필요한 카드들만 가져오기
        this.cards = this.spacedRepetitionService.getCardsForReview(allCards);
        
        
        if (this.cards.length === 0) {
            this.showNoCardsForReview(allCards.length);
            return;
        }

        // 복습 세션 시작
        this.currentSession = this.spacedRepetitionService.startReviewSession(this.cards);
        
        // 단어 순서 섞기 (새 카드가 먼저 오도록 조정 가능)
        this.shuffleCards();
        
        this.currentCardIndex = 0;
        this.showAnswer = false;
        this.showCard();
        // 키보드 이벤트 등록
        this.keydownHandler = (e: KeyboardEvent) => {
            if (!this.showAnswer) {
                if (e.code === 'Space' || e.key === ' ') {
                    e.preventDefault();
                    this.showAnswer = true;
                    this.showCard();
                }
            } else {
                if (e.key === '1') {
                    this.handleReview('hard');
                } else if (e.key === '2') {
                    this.handleReview('good');
                } else if (e.key === '3') {
                    this.handleReview('easy');
                }
            }
        };
        window.addEventListener('keydown', this.keydownHandler);
    }

    private shuffleCards() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    private showNoWordsMessage() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-learning-modal');

        // 설정된 높이를 CSS 변수로 적용
        contentEl.style.setProperty('--review-modal-height', `${this.plugin.settings.reviewModalHeight}vh`);

        const noWordsEl = contentEl.createEl('div', { cls: 'no-words-message' });
        noWordsEl.createEl('h2', { text: '학습할 단어가 없습니다' });
        noWordsEl.createEl('p', { text: '단어장에 단어를 추가한 후 다시 시도해주세요.' });
        
        const closeButton = noWordsEl.createEl('button', { text: '닫기' });
        closeButton.addClass('close-button');
        closeButton.addEventListener('click', () => this.close());
    }

    private showNoCardsForReview(totalCards: number) {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-learning-modal');

        // 설정된 높이를 CSS 변수로 적용
        contentEl.style.setProperty('--review-modal-height', `${this.plugin.settings.reviewModalHeight}vh`);

        const noReviewEl = contentEl.createEl('div', { cls: 'no-review-message' });
        noReviewEl.createEl('h2', { text: '🎉 오늘의 복습 완료!' });
        
        if (totalCards > 0) {
            const stats = this.spacedRepetitionService.calculateStatistics(this.plugin.databaseManager.getAllWords());
            noReviewEl.createEl('p', { 
                text: `총 ${totalCards}개의 단어 중 오늘 복습할 단어가 없습니다.` 
            });
            
            // 다음 복습 예정 정보
            const nextDueCards = this.spacedRepetitionService.getCardsDueInDays(
                this.plugin.databaseManager.getAllWords(), 
                1
            );
            if (nextDueCards > 0) {
                noReviewEl.createEl('p', { 
                    text: `내일 복습 예정: ${nextDueCards}개 단어` 
                });
            }

            // 학습 통계
            const statsEl = noReviewEl.createEl('div', { cls: 'study-stats' });
            statsEl.createEl('h3', { text: '학습 현황' });
            statsEl.createEl('p', { text: `• 새 단어: ${stats.overall.newCards}개` });
            statsEl.createEl('p', { text: `• 학습 중: ${stats.overall.learningCards}개` });
            statsEl.createEl('p', { text: `• 완료: ${stats.overall.matureCards}개` });
        } else {
            noReviewEl.createEl('p', { text: '단어장에 단어를 추가한 후 다시 시도해주세요.' });
        }
        
        const closeButton = noReviewEl.createEl('button', { text: '닫기' });
        closeButton.addClass('close-button');
        closeButton.addEventListener('click', () => this.close());
    }

    private showCard() {
        if (this.currentCardIndex >= this.cards.length) {
            this.showCompletionMessage();
            return;
        }

        const currentCard = this.cards[this.currentCardIndex];
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-learning-modal');

        // 설정된 높이를 CSS 변수로 적용
        contentEl.style.setProperty('--review-modal-height', `${this.plugin.settings.reviewModalHeight}vh`);

        const cardContainer = contentEl.createEl('div', { cls: 'vocabulary-card' });
        
        // 상단 정보 영역 (book 정보와 카드 삭제 버튼을 함께 배치)
        const topInfoContainer = cardContainer.createEl('div', { cls: 'card-top-info' });
        
        // 현재 book 정보 표시 (왼쪽)
        const currentBook = this.plugin.databaseManager.getCurrentBook();
        if (currentBook) {
            const bookInfoEl = topInfoContainer.createEl('div', { cls: 'book-info-display' });
            bookInfoEl.createEl('span', { 
                text: currentBook.name,
                cls: 'current-book-name'
            });
        }
        
        // 카드 삭제 버튼 (오른쪽)
        const deleteButton = topInfoContainer.createEl('button', { 
            text: '카드 삭제',
            cls: 'card-delete-button'
        });
        deleteButton.addEventListener('click', () => this.handleDeleteCard());
        
        // 진행률 표시
        const progressEl = cardContainer.createEl('div', { cls: 'progress-indicator' });
        progressEl.textContent = `${this.currentCardIndex + 1} / ${this.cards.length}`;
        
        // 단어 표시 (TTS 버튼 포함)
        const wordContainer = cardContainer.createEl('div', { cls: 'word-container' });
        const wordEl = wordContainer.createEl('h1', { cls: 'card-word' });
        if (currentCard.pronunciation && currentCard.pronunciation.trim()) {
            wordEl.textContent = currentCard.word;
            wordEl.appendText(' ');
            wordEl.createEl('span', { 
                text: `[${currentCard.pronunciation}]`,
                cls: 'pronunciation'
            });
        } else {
            wordEl.textContent = currentCard.word;
        }
        
        // 단어 발음 재생 버튼
        const wordPlayButton = wordContainer.createEl('button', { 
            cls: 'tts-play-button word-play-button',
            attr: { 'aria-label': '단어 발음 듣기' }
        });
        wordPlayButton.textContent = '🔊';
        wordPlayButton.addEventListener('click', () => {
            this.ttsService.speakWord(currentCard.word);
        });

        // 유사한 단어들
        if (currentCard.similarWords && currentCard.similarWords.length > 0) {
            const similarSection = cardContainer.createEl('div', { cls: 'similar-words-section' });
            const similarWordsText = similarSection.createEl('p', { 
                cls: 'similar-words-inline',
                text: `유사한 단어들: ${currentCard.similarWords.join(', ')}`
            });
        }

        // 예문들 (데이터베이스에서 가져온 예문 사용)
        if (currentCard.examples && currentCard.examples.length > 0) {
            const examplesSection = cardContainer.createEl('div', { cls: 'examples-section' });
            examplesSection.createEl('h3', { text: '예문들:' });
            currentCard.examples.forEach((example, index) => {
                const exampleContainer = examplesSection.createEl('div', { cls: 'example-container' });
                
                // 영어 예문 (TTS 버튼 포함)
                const exampleTextContainer = exampleContainer.createEl('div', { cls: 'example-text-container' });
                const englishExample = exampleTextContainer.createEl('p', { text: example.english });
                englishExample.addClass('english-example');
                
                // 예문 발음 재생 버튼
                const examplePlayButton = exampleTextContainer.createEl('button', { 
                    cls: 'tts-play-button example-play-button',
                    attr: { 'aria-label': '예문 발음 듣기' }
                });
                examplePlayButton.textContent = '🔊';
                examplePlayButton.addEventListener('click', () => {
                    this.ttsService.speakExample(example.english, currentCard.word);
                });
                
                // 한글 번역 (정답 확인 후에만 표시)
                if (this.showAnswer && example.korean && example.korean.trim()) {
                    const koreanExample = exampleContainer.createEl('p', { text: example.korean });
                    koreanExample.addClass('korean-example');
                }
            });
        } else {
            // 예문이 없을 때 기본 예문 표시
            const examplesSection = cardContainer.createEl('div', { cls: 'examples-section' });
            examplesSection.createEl('h3', { text: '예문들:' });
            const exampleContainer = examplesSection.createEl('div', { cls: 'example-container' });
            
            const exampleTextContainer = exampleContainer.createEl('div', { cls: 'example-text-container' });
            const englishExample = exampleTextContainer.createEl('p', { 
                text: `This is an example sentence with the word "${currentCard.word}".` 
            });
            englishExample.addClass('english-example');
            
            // 기본 예문 발음 재생 버튼
            const examplePlayButton = exampleTextContainer.createEl('button', { 
                cls: 'tts-play-button example-play-button',
                attr: { 'aria-label': '예문 발음 듣기' }
            });
            examplePlayButton.textContent = '🔊';
            examplePlayButton.addEventListener('click', () => {
                this.ttsService.speakExample(`This is an example sentence with the word "${currentCard.word}".`, currentCard.word);
            });
            
            // 한글 번역 (정답 확인 후에만 표시)
            if (this.showAnswer) {
                const koreanExample = exampleContainer.createEl('p', { 
                    text: `"${currentCard.word}"라는 단어가 포함된 예문입니다.` 
                });
                koreanExample.addClass('korean-example');
            }
        }

        // 정답 확인 버튼
        if (!this.showAnswer) {
            const checkButton = cardContainer.createEl('button', { text: '정답 확인하기' });
            checkButton.addClass('check-answer-button');
            checkButton.addEventListener('click', () => {
                this.showAnswer = true;
                this.showCard();
            });
        } else {
            // 정답 표시
            const answerSection = cardContainer.createEl('div', { cls: 'answer-section' });
            answerSection.createEl('h3', { text: '뜻:' });
            const meaningsList = answerSection.createEl('ul', { cls: 'meanings-list' });
            currentCard.meanings.forEach(meaning => {
                meaningsList.createEl('li', { text: meaning });
            });

            // 복습 버튼들
            this.createReviewButtons(cardContainer);
        }
    }

    private createReviewButtons(container: HTMLElement) {
        const reviewSection = container.createEl('div', { cls: 'review-buttons-section' });
        
        // Get next review intervals for current card
        const currentCard = this.cards[this.currentCardIndex];
        const intervals = this.spacedRepetitionService.getNextReviewIntervals(currentCard);
        
        // Hard button with interval
        const hardButton = reviewSection.createEl('button');
        hardButton.addClass('review-button', 'hard-button');
        const hardContent = hardButton.createEl('div', { cls: 'button-content' });
        hardContent.createEl('span', { text: '어려움', cls: 'button-label' });
        hardContent.createEl('span', { text: intervals.hard.displayText, cls: 'button-interval' });
        hardButton.addEventListener('click', () => this.handleReview('hard'));

        // Good button with interval
        const goodButton = reviewSection.createEl('button');
        goodButton.addClass('review-button', 'good-button');
        const goodContent = goodButton.createEl('div', { cls: 'button-content' });
        goodContent.createEl('span', { text: '좋음', cls: 'button-label' });
        goodContent.createEl('span', { text: intervals.good.displayText, cls: 'button-interval' });
        goodButton.addEventListener('click', () => this.handleReview('good'));

        // Easy button with interval
        const easyButton = reviewSection.createEl('button');
        easyButton.addClass('review-button', 'easy-button');
        const easyContent = easyButton.createEl('div', { cls: 'button-content' });
        easyContent.createEl('span', { text: '쉬움', cls: 'button-label' });
        easyContent.createEl('span', { text: intervals.easy.displayText, cls: 'button-interval' });
        easyButton.addEventListener('click', () => this.handleReview('easy'));
    }

    private async handleReview(difficulty: 'easy' | 'good' | 'hard') {
        const currentCard = this.cards[this.currentCardIndex];
        
        // Check if SpacedRepetitionService has an active session
        const activeSession = this.spacedRepetitionService.getCurrentSession();
        if (!activeSession) {
            console.error('No active review session in SpacedRepetitionService');
            // Fallback: start a new session with remaining cards
            const remainingCards = this.cards.slice(this.currentCardIndex);
            if (remainingCards.length > 0) {
                this.currentSession = this.spacedRepetitionService.startReviewSession(remainingCards);
            } else {
                console.error('No remaining cards to review');
                return;
            }
        }
        
        // Convert difficulty to ReviewResponse enum
        const reviewResponse = difficulty as ReviewResponse;
        
        try {
            // Process review using spaced repetition service
            const result = this.spacedRepetitionService.processReview(currentCard, reviewResponse);
            
            // Update card in database with new schedule information
            await this.plugin.databaseManager.updateWordWithSchedule(
                result.updatedCard.word, 
                difficulty,
                result.updatedCard.scheduleInfo
            );
            
            // 다음 카드로 이동
            this.currentCardIndex++;
            this.showAnswer = false;
            this.showCard();
            
        } catch (error) {
            console.error('Error processing spaced repetition review:', error);
            // Fallback to old method if spaced repetition fails
            await this.plugin.databaseManager.updateWord(currentCard.word, difficulty);
            this.currentCardIndex++;
            this.showAnswer = false;
            this.showCard();
        }
    }

    private async handleDeleteCard() {
        const currentCard = this.cards[this.currentCardIndex];
        
        const confirmModal = new ConfirmModal(
            this.app,
            '단어 삭제',
            `"${currentCard.word}" 단어를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
            async () => {
                try {
                    // 데이터베이스에서 단어 삭제
                    await this.plugin.databaseManager.removeWord(currentCard.word);
                    
                    // 현재 단어 목록에서도 제거
                    this.cards.splice(this.currentCardIndex, 1);
                    
                    // 단어가 더 이상 없으면 완료 화면으로
                    if (this.cards.length === 0) {
                        this.showCompletionMessage();
                        return;
                    }
                    
                    // 현재 인덱스가 단어 목록 범위를 벗어나면 조정
                    if (this.currentCardIndex >= this.cards.length) {
                        this.currentCardIndex = this.cards.length - 1;
                    }
                    
                    // 다음 단어 표시
                    this.showAnswer = false;
                    this.showCard();
                    
                } catch (error) {
                    console.error('단어 삭제 중 오류 발생:', error);
                    new Notice('단어 삭제 중 오류가 발생했습니다.');
                }
            }
        );
        confirmModal.open();
    }

    private showCompletionMessage() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-learning-modal');

        // 설정된 높이를 CSS 변수로 적용
        contentEl.style.setProperty('--review-modal-height', `${this.plugin.settings.reviewModalHeight}vh`);

        const completionEl = contentEl.createEl('div', { cls: 'completion-message' });
        completionEl.createEl('h2', { text: '학습 완료!' });
        completionEl.createEl('p', { text: `오늘 ${this.cards.length}개의 단어 학습을 완료했습니다.` });

        const restartButton = completionEl.createEl('button', { text: '다시 학습하기' });
        restartButton.addClass('restart-button');
        restartButton.addEventListener('click', () => {
            this.onOpen();
        });

        const closeButton = completionEl.createEl('button', { text: '닫기' });
        closeButton.addClass('close-button');
        closeButton.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 간단한 확인 모달 클래스
class ConfirmModal extends Modal {
    title: string;
    message: string;
    onConfirm: () => void;

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
        contentEl.createEl('p', { text: this.message, cls: 'modal-message' });

        const buttonSection = contentEl.createEl('div', { cls: 'button-section' });
        
        const confirmButton = buttonSection.createEl('button', { 
            text: '확인',
            cls: 'confirm-button primary'
        });
        confirmButton.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });

        const cancelButton = buttonSection.createEl('button', { 
            text: '취소',
            cls: 'cancel-button'
        });
        cancelButton.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 