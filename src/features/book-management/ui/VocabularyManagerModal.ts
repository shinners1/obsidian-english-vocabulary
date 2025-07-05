import { Modal, App, Notice } from 'obsidian';
import EnglishVocabularyPlugin from '../../../main';
import { VocabularyCard, Book } from '../../../VocabularyCard';
import { VocabularyDatabaseManager } from '../../../infrastructure/storage/VocabularyDatabase';
import { WordService } from '../../../infrastructure/external/WordService';
import { LLMService } from '../../../infrastructure/llm/LLMService';
import { VocabularyModal } from '../../vocabulary-learning/ui/VocabularyModal';
import { AddBookModal } from './AddBookModal';
import { AddWordsModal } from '../../word-management/ui/AddWordsModal';
import { formatDate } from '../../../utils';

export class VocabularyManagerModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    databaseManager: VocabularyDatabaseManager;
    wordService: WordService;
    llmService: LLMService;
    currentView: 'list' | 'statistics' | 'add' = 'list';
    selectedWords: Set<string> = new Set();
    selectedBookId: string = '';

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app);
        this.plugin = plugin;
        this.databaseManager = plugin.databaseManager;
        this.wordService = new WordService();
        this.llmService = plugin.llmService;
        this.selectedBookId = this.databaseManager.getCurrentBook()?.id || 'default';
    }

    private hasValidApiKey(): boolean {
        const provider = this.plugin.settings.llmProvider;
        switch (provider) {
            case 'openai':
                return !!this.plugin.settings.openaiApiKey;
            case 'anthropic':
                return !!this.plugin.settings.anthropicApiKey;
            case 'google':
                return !!this.plugin.settings.googleApiKey;
            default:
                return false;
        }
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vocabulary-manager-modal');
        contentEl.classList.add('wide-manager-modal');

        // 데이터베이스에서 최신 데이터 로드
        await this.databaseManager.loadAllBooks();
        
        // 현재 선택된 단어장 업데이트
        this.selectedBookId = this.databaseManager.getCurrentBook()?.id || 'default';

        this.createBookSelectorHeader();
        this.createNavigation();
        this.showCurrentView();

        // 단어장 생성 이벤트 리스너 추가
        document.addEventListener('bookCreated', this.handleBookCreated.bind(this));
    }

    private async handleBookCreated(event: CustomEvent) {
        const newBook = event.detail;
        this.selectedBookId = newBook.id;
        await this.refreshBookSelector();
    }

    private createBookSelectorHeader() {
        const headerEl = this.contentEl.createEl('div', { cls: 'manager-header' });

        const books = this.databaseManager.getAllBooks();
        const bookSelect = headerEl.createEl('select', { cls: 'book-select-dropdown' });
        books.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.text = book.name;
            if (book.id === this.selectedBookId) option.selected = true;
            bookSelect.appendChild(option);
        });
        bookSelect.addEventListener('change', async (e) => {
            this.selectedBookId = (e.target as HTMLSelectElement).value;
            await this.databaseManager.setCurrentBook(this.selectedBookId);
            this.showCurrentView();
        });

        const addBookBtn = headerEl.createEl('button', { text: '새 단어장 추가', cls: 'book-manage-button' });
        addBookBtn.addEventListener('click', () => {
            const addBookModal = new AddBookModal(this.app, this.plugin);
            addBookModal.onClose = () => {
                // 단어장이 생성되면 드롭다운과 선택을 새로고침
                this.refreshBookSelector();
            };
            addBookModal.open();
        });

        const delBookBtn = headerEl.createEl('button', { text: '현재 단어장 삭제', cls: 'book-delete-button' });
        const isDefault = this.selectedBookId === 'default';
        if (isDefault) {
            delBookBtn.setAttr('disabled', 'true');
            delBookBtn.addClass('disabled');
        }
        delBookBtn.addEventListener('click', async () => {
            if (isDefault) return;
            
            // 현재 선택된 단어장 정보 가져오기
            const currentBook = this.databaseManager.getBook(this.selectedBookId);
            if (!currentBook) {
                new Notice('단어장 정보를 찾을 수 없습니다.');
                return;
            }
            
            // 단어장의 단어 수 확인
            const wordsInBook = this.databaseManager.getWordsByBook(this.selectedBookId);
            const wordCount = wordsInBook.length;
            
            // 상세한 확인 모달 표시
            const confirmModal = new ConfirmModal(
                this.app,
                '단어장 삭제 확인',
                `정말로 "${currentBook.name}" 단어장을 삭제하시겠습니까?\n\n` +
                `• 단어장 이름: ${currentBook.name}\n` +
                `• 포함된 단어 수: ${wordCount}개\n` +
                `• 생성일: ${new Date(currentBook.createdAt).toLocaleDateString('ko-KR')}\n\n` +
                `⚠️ 이 작업은 되돌릴 수 없으며, 단어장과 모든 단어가 영구적으로 삭제됩니다.`,
                async () => {
                    try {
                        await this.databaseManager.deleteBook(this.selectedBookId);
                        this.selectedBookId = 'default';
                        await this.databaseManager.setCurrentBook('default');
                        new Notice(`"${currentBook.name}" 단어장이 성공적으로 삭제되었습니다.`);
                        this.onOpen();
                    } catch (e) {
                        new Notice('단어장 삭제 실패: ' + e.message);
                    }
                }
            );
            confirmModal.open();
        });
    }

    private createNavigation() {
        const navEl = this.contentEl.createEl('div', { cls: 'manager-navigation' });
        const listBtn = navEl.createEl('button', { text: '단어 목록', cls: 'nav-button' });
        listBtn.addEventListener('click', () => {
            this.currentView = 'list';
            this.showCurrentView();
        });
        const statsBtn = navEl.createEl('button', { text: '통계', cls: 'nav-button' });
        statsBtn.addEventListener('click', () => {
            this.currentView = 'statistics';
            this.showCurrentView();
        });
        const addBtn = navEl.createEl('button', { text: '단어 추가', cls: 'nav-button' });
        addBtn.addEventListener('click', () => {
            this.close();
            new AddWordsModal(this.app, this.plugin, this.selectedBookId).open();
        });
        const startLearningButton = navEl.createEl('button', { 
            text: '영어 단어 학습 시작',
            cls: 'nav-button'
        });
        startLearningButton.addEventListener('click', () => {
            this.close();
            new VocabularyModal(this.app, this.plugin).open();
        });
    }

    private showCurrentView() {
        const contentEl = this.contentEl.querySelector('.manager-content') || 
                         this.contentEl.createEl('div', { cls: 'manager-content' });
        contentEl.empty();
        switch (this.currentView) {
            case 'list':
                this.showWordList(contentEl as HTMLElement);
                break;
            case 'statistics':
                this.showStatistics(contentEl as HTMLElement);
                break;
            case 'add':
                this.showAddWord(contentEl as HTMLElement);
                break;
        }
    }

    private showWordList(container: HTMLElement) {
        const words = this.databaseManager.getAllWords();
        
        if (words.length === 0) {
            container.createEl('p', { 
                text: '단어장이 비어있습니다. 단어를 추가해보세요!',
                cls: 'empty-message'
            });
            return;
        }

        const searchEl = container.createEl('div', { cls: 'search-section' });
        const searchInput = searchEl.createEl('input', {
            type: 'text',
            placeholder: '단어 검색...',
            cls: 'search-input'
        });

        const selectionControls = searchEl.createEl('div', { cls: 'selection-controls' });
        
        const allSelected = this.selectedWords.size === words.length && words.length > 0;
        const selectAllBtn = selectionControls.createEl('button', { 
            text: allSelected ? '전체 해제' : '전체 선택',
            cls: 'selection-button'
        });
        selectAllBtn.addEventListener('click', () => {
            if (this.selectedWords.size === words.length) {
                this.selectedWords.clear();
            } else {
                this.selectedWords.clear();
                words.forEach(word => this.selectedWords.add(word.word));
            }
            this.showCurrentView();
        });

        const selectWordsWithoutMeaningsBtn = selectionControls.createEl('button', { 
            text: '뜻 없는 단어 선택',
            cls: 'select-no-meanings-button'
        });
        selectWordsWithoutMeaningsBtn.addEventListener('click', () => {
            this.selectWordsWithoutMeanings(words);
        });

        const fetchSelectedButton = selectionControls.createEl('button', { 
            text: '선택 단어 뜻 가져오기',
            cls: 'fetch-selected-button'
        });
        fetchSelectedButton.addEventListener('click', () => {
            if (this.selectedWords.size === 0) {
                new Notice('선택된 단어가 없습니다.');
                return;
            }
            this.showFetchSelectedMeaningsModal();
        });

        const wordListEl = container.createEl('div', { cls: 'word-list' });
        
        const renderWords = (filteredWords: VocabularyCard[]) => {
            wordListEl.empty();
            filteredWords.forEach(word => {
                this.createWordItem(wordListEl, word);
            });
        };

        searchInput.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value;
            const filteredWords = query ? 
                this.databaseManager.searchWords(query) : words;
            renderWords(filteredWords);
        });

        renderWords(words);
    }

    private createWordItem(container: HTMLElement, word: VocabularyCard) {
        const wordEl = container.createEl('div', { cls: 'word-item' });
        
        const checkbox = wordEl.createEl('input', {
            type: 'checkbox',
            cls: 'word-checkbox'
        });
        checkbox.checked = this.selectedWords.has(word.word);
        checkbox.addEventListener('change', (e) => {
            const isChecked = (e.target as HTMLInputElement).checked;
            if (isChecked) {
                this.selectedWords.add(word.word);
            } else {
                this.selectedWords.delete(word.word);
            }
        });
        
        const wordHeader = wordEl.createEl('div', { cls: 'word-header' });
        
        const wordTitleEl = wordHeader.createEl('h3', { cls: 'word-title' });
        if (word.pronunciation && word.pronunciation.trim()) {
            wordTitleEl.textContent = word.word;
            wordTitleEl.appendText(' ');
            wordTitleEl.createEl('span', { 
                text: `[${word.pronunciation}]`,
                cls: 'pronunciation'
            });
        } else {
            wordTitleEl.textContent = word.word;
        }
        
        const difficultyBadge = wordHeader.createEl('span', { 
            text: this.getDifficultyText(word.difficulty),
            cls: `difficulty-badge ${word.difficulty}`
        });

        const wordContent = wordEl.createEl('div', { cls: 'word-content' });
        wordContent.createEl('p', { 
            text: `뜻: ${word.meanings.join(', ')}`,
            cls: 'word-meanings'
        });
        
        wordContent.createEl('p', { 
            text: `복습 횟수: ${word.reviewCount}회`,
            cls: 'review-count'
        });

        if (word.lastReviewed) {
            wordContent.createEl('p', { 
                text: `마지막 복습: ${formatDate(word.lastReviewed)}`,
                cls: 'last-reviewed'
            });
        }

        const wordActions = wordEl.createEl('div', { cls: 'word-actions' });
        
        if (this.plugin.settings.enableAdvancedFeatures) {
            const fetchButton = wordActions.createEl('button', { 
                text: '단어 뜻 가져오기',
                cls: 'action-button fetch-single-button'
            });
            fetchButton.addEventListener('click', () => {
                this.fetchSingleWordMeaning(word);
            });
        }

        const deleteBtn = wordActions.createEl('button', { 
            text: '삭제',
            cls: 'action-button delete-button'
        });
        deleteBtn.addEventListener('click', async () => {
            const confirmModal = new ConfirmModal(
                this.app,
                '단어 삭제',
                `"${word.word}" 단어를 삭제하시겠습니까?`,
                async () => {
                    await this.databaseManager.removeWord(word.word);
                    this.showCurrentView();
                }
            );
            confirmModal.open();
        });
    }

    private showStatistics(container: HTMLElement) {
        const stats = this.databaseManager.getStatistics();
        
        const statsGrid = container.createEl('div', { cls: 'stats-grid' });
        
        const basicStats = statsGrid.createEl('div', { cls: 'stats-section' });
        basicStats.createEl('h3', { text: '기본 통계', cls: 'stats-title' });
        
        this.createStatItem(basicStats, '총 단어 수', stats.totalWords.toString());
        this.createStatItem(basicStats, '총 복습 횟수', stats.totalReviews.toString());
        this.createStatItem(basicStats, '연속 학습일', `${stats.streakDays}일`);
        this.createStatItem(basicStats, '평균 난이도', stats.averageDifficulty.toFixed(1));

        const difficultyStats = statsGrid.createEl('div', { cls: 'stats-section' });
        difficultyStats.createEl('h3', { text: '난이도별 분포', cls: 'stats-title' });
        
        this.createStatItem(difficultyStats, '쉬움', stats.wordsByDifficulty.easy.toString());
        this.createStatItem(difficultyStats, '좋음', stats.wordsByDifficulty.good.toString());
        this.createStatItem(difficultyStats, '어려움', stats.wordsByDifficulty.hard.toString());

        const activityStats = statsGrid.createEl('div', { cls: 'stats-section' });
        activityStats.createEl('h3', { text: '최근 7일 활동', cls: 'stats-title' });
        
        stats.recentActivity.forEach(activity => {
            const date = new Date(activity.date).toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric' 
            });
            this.createStatItem(activityStats, date, 
                `학습: ${activity.wordsStudied}, 복습: ${activity.reviewsCompleted}`);
        });
    }

    private createStatItem(container: HTMLElement, label: string, value: string) {
        const statEl = container.createEl('div', { cls: 'stat-item' });
        statEl.createEl('span', { text: label, cls: 'stat-label' });
        statEl.createEl('span', { text: value, cls: 'stat-value' });
    }

    private showAddWord(container: HTMLElement) {
        const addSection = container.createEl('div', { cls: 'add-word-section' });
        
        addSection.createEl('h3', { text: '새 단어 추가', cls: 'section-title' });
        
        const inputEl = addSection.createEl('div', { cls: 'word-input-group' });
        const wordInput = inputEl.createEl('input', {
            type: 'text',
            placeholder: '영단어를 입력하세요 (예: beautiful)',
            cls: 'word-input'
        });

        const addButton = inputEl.createEl('button', { 
            text: '단어 추가',
            cls: 'add-button'
        });

        const addWord = async () => {
            const word = wordInput.value.trim();
            if (!word) {
                addSection.createEl('p', { 
                    text: '단어를 입력해주세요.',
                    cls: 'error-message'
                });
                return;
            }

            try {
                const wordData = await this.wordService.getWordData(word);
                const vocabularyCard: VocabularyCard = {
                    ...wordData,
                    reviewCount: 0,
                    difficulty: 'good',
                    lastReviewed: null,
                    addedDate: new Date().toISOString(),
                    bookId: this.selectedBookId
                };
                await this.databaseManager.addWord(vocabularyCard);
                
                wordInput.value = '';
                addSection.createEl('p', { 
                    text: `"${word}" 단어가 성공적으로 추가되었습니다!`,
                    cls: 'success-message'
                });
                
                setTimeout(() => {
                    const successMsg = addSection.querySelector('.success-message');
                    if (successMsg) successMsg.remove();
                }, 3000);
            } catch (error) {
                addSection.createEl('p', { 
                    text: '단어를 추가하는 중 오류가 발생했습니다.',
                    cls: 'error-message'
                });
            }
        };

        addButton.addEventListener('click', addWord);
        wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addWord();
            }
        });
    }

    private getDifficultyText(difficulty: 'none' | 'easy' | 'good' | 'hard'): string {
        switch (difficulty) {
            case 'none': return '미학습';
            case 'easy': return '쉬움';
            case 'good': return '좋음';
            case 'hard': return '어려움';
            default: return '좋음';
        }
    }

    private startReview(words: VocabularyCard[]) {
        const reviewModal = new VocabularyReviewModal(this.app, this.plugin, words);
        reviewModal.open();
    }

    private showFetchSelectedMeaningsModal() {
        const selectedWordList = Array.from(this.selectedWords);
        new FetchSelectedMeaningsModal(this.app, this.plugin, selectedWordList).open();
    }


    private async fetchSingleWordMeaning(word: VocabularyCard) {
        if (!this.hasValidApiKey()) {
            new Notice('LLM API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
            return;
        }

        const confirmModal = new ConfirmModal(
            this.app,
            '단어 뜻 가져오기',
            `"${word.word}" 단어의 뜻을 새로 가져오시겠습니까? 기존 정보가어씌워집니다.`,
            async () => {
                try {
                    new Notice(`"${word.word}" 단어 정보를 가져오는 중...`);
                    
                    const llmResponse = await this.plugin.llmService.getWordDetails(word.word);
                    
                    if (llmResponse.success) {
                        const wordDetail = llmResponse.data;
                        const wordData = this.plugin.llmService.convertToWordData(wordDetail);
                        
                        const updatedWord = {
                            ...word,
                            meanings: wordData.meanings,
                            examples: wordData.examples,
                            similarWords: wordData.similarWords
                        };
                        
                        await this.plugin.databaseManager.updateWordData(word.word, updatedWord);
                        new Notice(`"${word.word}" 단어 정보가 성공적으로 업데이트되었습니다!`);
                        
                        this.showCurrentView();
                    } else {
                        new Notice(`"${word.word}" 단어 정보 가져오기 실패: ${llmResponse.error}`);
                    }
                } catch (error) {
                    console.error(`단어 "${word.word}" 처리 실패:`, error);
                    new Notice(`"${word.word}" 단어 처리 중 오류가 발생했습니다.`);
                }
            }
        );
        confirmModal.open();
    }

    private async refreshBookSelector() {
        // 데이터베이스에서 단어장을 다시 로드
        await this.databaseManager.loadAllBooks();
        
        // 헤더의 단어장 선택 드롭다운을 새로고침
        const headerEl = this.contentEl.querySelector('.manager-header');
        if (headerEl) {
            const bookSelect = headerEl.querySelector('.book-select-dropdown') as HTMLSelectElement;
            if (bookSelect) {
                const currentValue = bookSelect.value;
                const books = this.databaseManager.getAllBooks();
                
                // 기존 옵션들 제거
                bookSelect.empty();
                
                // 새로운 옵션들 추가
                books.forEach(book => {
                    const option = document.createElement('option');
                    option.value = book.id;
                    option.text = book.name;
                    if (book.id === currentValue || book.id === this.selectedBookId) {
                        option.selected = true;
                        this.selectedBookId = book.id;
                    }
                    bookSelect.appendChild(option);
                });
            }
        }
        
        // 현재 뷰 새로고침
        this.showCurrentView();
    }

    private selectWordsWithoutMeanings(words: VocabularyCard[]) {
        // 뜻이 없는 단어들 찾기
        const wordsWithoutMeanings = words.filter(word => {
            // meanings 배열이 없거나 비어있는 경우
            if (!word.meanings || word.meanings.length === 0) {
                return true;
            }
            
            // meanings 배열에 빈 문자열만 있는 경우
            if (word.meanings.length === 1 && word.meanings[0].trim() === '') {
                return true;
            }
            
            // "의미를 찾을 수 없습니다." 같은 기본 메시지가 있는 경우
            const invalidMeanings = word.meanings.filter(meaning => {
                const cleanMeaning = meaning.trim();
                return cleanMeaning === '' || 
                       cleanMeaning === '의미를 찾을 수 없습니다.' ||
                       cleanMeaning === 'Meaning not found' ||
                       cleanMeaning === '뜻을 찾을 수 없습니다.' ||
                       cleanMeaning.includes('찾을 수 없습니다');
            });
            
            // 모든 의미가 유효하지 않은 경우
            return invalidMeanings.length === word.meanings.length;
        });

        if (wordsWithoutMeanings.length === 0) {
            new Notice('뜻이 없는 단어가 없습니다.');
            return;
        }

        // 기존 선택 초기화
        this.selectedWords.clear();
        
        // 뜻이 없는 단어들을 선택
        wordsWithoutMeanings.forEach(word => {
            this.selectedWords.add(word.word);
        });

        new Notice(`${wordsWithoutMeanings.length}개의 뜻 없는 단어를 선택했습니다.`);
        
        // 뷰 새로고침하여 체크박스 상태 업데이트
        this.showCurrentView();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 이벤트 리스너 제거
        document.removeEventListener('bookCreated', this.handleBookCreated.bind(this));
    }
}


class VocabularyReviewModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    words: VocabularyCard[];
    currentIndex = 0;
    showAnswer = false;

    constructor(app: App, plugin: EnglishVocabularyPlugin, words: VocabularyCard[]) {
        super(app);
        this.plugin = plugin;
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
        contentEl.style.setProperty('--review-modal-height', `${this.plugin.settings.reviewModalHeight}vh`);

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
                similarEl.createEl('h3', { text: '유사한 단어들:' });
                const similarList = similarEl.createEl('ul');
                currentWord.similarWords.forEach(word => {
                    similarList.createEl('li', { text: word });
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

    private async handleReview(difficulty: 'easy' | 'good' | 'hard') {
        const currentWord = this.words[this.currentIndex];
        await this.plugin.databaseManager.updateWord(currentWord.word, difficulty);

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
                    await this.plugin.databaseManager.removeWord(currentWord.word);
                    
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

class FetchSelectedMeaningsModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    selectedWords: string[];
    isProcessing = false;

    constructor(app: App, plugin: EnglishVocabularyPlugin, selectedWords: string[]) {
        super(app);
        this.plugin = plugin;
        this.selectedWords = selectedWords;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('fetch-selected-meanings-modal');

        contentEl.createEl('h2', { 
            text: `선택된 ${this.selectedWords.length}개 단어 뜻 가져오기`,
            cls: 'modal-title'
        });

        contentEl.createEl('p', { 
            text: `선택된 단어들의 상세 정보를 LLM API를 통해 가져옵니다.`,
            cls: 'modal-description'
        });

        const wordListEl = contentEl.createEl('div', { cls: 'selected-words-list' });
        wordListEl.createEl('h3', { text: '선택된 단어들:' });
        const wordsContainer = wordListEl.createEl('div', { cls: 'words-container' });
        
        this.selectedWords.forEach(word => {
            wordsContainer.createEl('span', { 
                text: word,
                cls: 'selected-word-tag'
            });
        });

        const buttonSection = contentEl.createEl('div', { cls: 'button-section' });
        
        const fetchButton = buttonSection.createEl('button', { 
            text: '뜻 가져오기',
            cls: 'fetch-button'
        });
        fetchButton.addEventListener('click', () => {
            this.fetchSelectedMeanings();
        });

        const cancelButton = buttonSection.createEl('button', { 
            text: '취소',
            cls: 'cancel-button'
        });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const progressSection = contentEl.createEl('div', { cls: 'progress-section display-none' });
        
        const progressText = progressSection.createEl('div', { cls: 'progress-text' });
        const progressBar = progressSection.createEl('div', { cls: 'progress-bar' });
        const progressFill = progressBar.createEl('div', { cls: 'progress-fill' });

        const resultSection = contentEl.createEl('div', { cls: 'result-section display-none' });
    }

    private async fetchSelectedMeanings() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.showProgress(this.selectedWords.length);

        try {
            const result = await this.plugin.llmService.getMultipleWordDetails(this.selectedWords);
            
            if (result.success && Array.isArray(result.data)) {
                const successWords: string[] = [];
                const failedWords: string[] = [];

                for (const wordData of result.data) {
                    try {
                        if (wordData.word && wordData.meanings && wordData.meanings.length > 0) {
                            const existingWord = this.plugin.databaseManager.getWord(wordData.word);
                            if (existingWord) {
                                const updatedWord: VocabularyCard = {
                                    ...existingWord,
                                    pronunciation: wordData.pronunciation || '',
                                    meanings: wordData.meanings,
                                    examples: wordData.examples || [],
                                    similarWords: wordData.similarWords || []
                                };
                                await this.plugin.databaseManager.updateWordData(wordData.word, updatedWord);
                                successWords.push(wordData.word);
                            }
                        } else {
                            failedWords.push(wordData.word);
                        }
                    } catch (error) {
                        console.error(`단어 "${wordData.word}" 업데이트 실패:`, error);
                        failedWords.push(wordData.word);
                    }
                }

                this.hideProgress();
                this.showResults({ success: successWords, failed: failedWords });
                
                if (successWords.length > 0) {
                    new Notice(`${successWords.length}개의 단어 정보를 성공적으로 업데이트했습니다!`);
                }
            } else {
                this.hideProgress();
                new Notice('단어 정보를 가져오는데 실패했습니다: ' + (result.error || '알 수 없는 오류'));
            }
        } catch (error) {
            this.hideProgress();
            new Notice('단어 정보를 가져오는데 실패했습니다: ' + error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    private showProgress(totalWords: number) {
        const progressSection = this.contentEl.querySelector('.progress-section') as HTMLElement;
        const progressText = progressSection.querySelector('.progress-text') as HTMLElement;
        
        progressSection.removeClass('display-none');
        progressSection.addClass('display-block');
        progressText.textContent = `단어 정보를 가져오는 중... (0/${totalWords})`;
    }

    private hideProgress() {
        const progressSection = this.contentEl.querySelector('.progress-section') as HTMLElement;
        if (progressSection) {
            progressSection.removeClass('display-block');
            progressSection.addClass('display-none');
        }
    }

    private showResults(results: { success: string[]; failed: string[] }) {
        const resultSection = this.contentEl.querySelector('.result-section') as HTMLElement;
        resultSection.removeClass('display-none');
        resultSection.addClass('display-block');
        resultSection.empty();

        const summaryEl = resultSection.createEl('div', { cls: 'results-summary' });
        
        if (results.success.length > 0) {
            const successEl = summaryEl.createEl('div', { cls: 'result-item success' });
            successEl.createEl('span', { 
                text: `✅ 성공: ${results.success.length}개`,
                cls: 'result-count'
            });
            if (results.success.length <= 10) {
                successEl.createEl('p', { 
                    text: results.success.join(', '),
                    cls: 'result-words'
                });
            }
        }

        if (results.failed.length > 0) {
            const failedEl = summaryEl.createEl('div', { cls: 'result-item error' });
            failedEl.createEl('span', { 
                text: `❌ 실패: ${results.failed.length}개`,
                cls: 'result-count'
            });
            if (results.failed.length <= 10) {
                failedEl.createEl('p', { 
                    text: results.failed.join(', '),
                    cls: 'result-words'
                });
            }
        }

        const buttonSection = resultSection.createEl('div', { cls: 'result-buttons' });
        
        const closeButton = buttonSection.createEl('button', { text: '닫기', cls: 'close-button' });
        closeButton.addEventListener('click', () => this.close());
    }

    onClose() {
        this.isProcessing = false;
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