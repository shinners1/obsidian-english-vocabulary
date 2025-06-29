import { Modal, App, Notice } from 'obsidian';
import EnglishVocabularyPlugin from './main';
import { VocabularyCard } from './VocabularyCard';
import { TTSService } from './TTSService';

export class VocabularyModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    currentCardIndex = 0;
    cards: VocabularyCard[] = [];
    showAnswer = false;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private ttsService: TTSService;

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app);
        this.plugin = plugin;
        this.ttsService = new TTSService({
            enabled: plugin.settings.ttsEnabled,
            voice: plugin.settings.ttsVoice,
            playbackSpeed: plugin.settings.ttsPlaybackSpeed,
            autoPlay: plugin.settings.ttsAutoPlay
        });
    }

    onOpen() {
        // 저장된 모든 단어 가져오기
        this.cards = this.plugin.databaseManager.getAllWords();
        
        // 디버깅: 카드 데이터 확인
        console.log('로드된 카드 수:', this.cards.length);
        if (this.cards.length > 0) {
            console.log('첫 번째 카드 예문:', this.cards[0].examples);
        }
        
        if (this.cards.length === 0) {
            this.showNoWordsMessage();
            return;
        }

        // 단어 순서 섞기
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
            wordEl.innerHTML = `${currentCard.word} <span class="pronunciation">[${currentCard.pronunciation}]</span>`;
        } else {
            wordEl.textContent = currentCard.word;
        }
        
        // 단어 발음 재생 버튼
        const wordPlayButton = wordContainer.createEl('button', { 
            cls: 'tts-play-button word-play-button',
            attr: { 'aria-label': '단어 발음 듣기' }
        });
        wordPlayButton.innerHTML = '🔊';
        wordPlayButton.addEventListener('click', () => {
            this.ttsService.speakWord(currentCard.word);
        });

        // 유사한 단어들
        if (currentCard.similarWords && currentCard.similarWords.length > 0) {
            const similarSection = cardContainer.createEl('div', { cls: 'similar-words-section' });
            similarSection.createEl('h3', { text: '유사한 단어들:' });
            const similarList = similarSection.createEl('ul', { cls: 'similar-words-list' });
            currentCard.similarWords.forEach(word => {
                similarList.createEl('li', { text: word });
            });
        }

        // 예문들 (데이터베이스에서 가져온 예문 사용)
        console.log('현재 카드 예문:', currentCard.examples);
        if (currentCard.examples && currentCard.examples.length > 0) {
            const examplesSection = cardContainer.createEl('div', { cls: 'examples-section' });
            examplesSection.createEl('h3', { text: '예문들:' });
            currentCard.examples.forEach((example, index) => {
                console.log(`예문 ${index + 1}:`, example);
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
                examplePlayButton.innerHTML = '🔊';
                examplePlayButton.addEventListener('click', () => {
                    this.ttsService.speakExample(example.english);
                });
                
                // 한글 번역
                if (example.korean && example.korean.trim()) {
                    const koreanExample = exampleContainer.createEl('p', { text: example.korean });
                    koreanExample.addClass('korean-example');
                }
            });
        } else {
            // 예문이 없을 때 기본 예문 표시
            console.log('예문이 없어서 기본 예문을 표시합니다.');
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
            examplePlayButton.innerHTML = '🔊';
            examplePlayButton.addEventListener('click', () => {
                this.ttsService.speakExample(`This is an example sentence with the word "${currentCard.word}".`);
            });
            
            const koreanExample = exampleContainer.createEl('p', { 
                text: `"${currentCard.word}"라는 단어가 포함된 예문입니다.` 
            });
            koreanExample.addClass('korean-example');
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
        
        const hardButton = reviewSection.createEl('button', { text: '어려움' });
        hardButton.addClass('review-button', 'hard-button');
        hardButton.addEventListener('click', () => this.handleReview('hard'));

        const goodButton = reviewSection.createEl('button', { text: '좋음' });
        goodButton.addClass('review-button', 'good-button');
        goodButton.addEventListener('click', () => this.handleReview('good'));

        const easyButton = reviewSection.createEl('button', { text: '쉬움' });
        easyButton.addClass('review-button', 'easy-button');
        easyButton.addEventListener('click', () => this.handleReview('easy'));
    }

    private async handleReview(difficulty: 'easy' | 'good' | 'hard') {
        const currentCard = this.cards[this.currentCardIndex];
        
        // 데이터베이스 업데이트
        await this.plugin.databaseManager.updateWord(currentCard.word, difficulty);
        
        // 다음 카드로 이동
        this.currentCardIndex++;
        this.showAnswer = false;
        this.showCard();
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