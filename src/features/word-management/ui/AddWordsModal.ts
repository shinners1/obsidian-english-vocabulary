import { Modal, App, Notice } from 'obsidian';
import EnglishVocabularyPlugin from '../../../main';
import { WordService } from '../../../infrastructure/external/WordService';
import { AddBookModal } from '../../book-management/ui/AddBookModal';
import { validateWord, validateBatch, sanitizeMarkdown } from '../../../shared/validation';
import { CancellationTokenSource, CancellationError, processBatchWithCancellation } from '../../../shared/CancellationToken';
import { getConfigValue, CONFIG_PATHS } from '../../../shared/Config';

export class AddWordsModal extends Modal {
    plugin: EnglishVocabularyPlugin;
    wordService: WordService;
    isProcessing = false;
    private bookSelect: HTMLSelectElement;
    private cancellationTokenSource: CancellationTokenSource | null = null;

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app);
        this.plugin = plugin;
        this.wordService = new WordService();
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('add-words-modal');

        // 데이터베이스에서 최신 데이터 로드
        await this.plugin.databaseManager.loadAllBooks();

        // 단어장 선택 드롭다운
        const bookSelectSection = contentEl.createEl('div', { cls: 'book-select-section' });
        const bookLabel = bookSelectSection.createEl('label', { text: '단어장 선택', cls: 'book-select-label' });
        
        const bookSelectContainer = bookSelectSection.createEl('div', { cls: 'book-select-container' });
        this.bookSelect = bookSelectContainer.createEl('select', { cls: 'book-select-dropdown' });
        
        // 단어장 추가 버튼
        const addBookButton = bookSelectContainer.createEl('button', {
            text: '단어장 추가',
            cls: 'add-book-button'
        });
        addBookButton.addEventListener('click', () => this.openAddBookModal());
        
        await this.updateBookSelect();
        
        this.bookSelect.addEventListener('change', (e) => {
            const selectedBookId = (e.target as HTMLSelectElement).value;
            this.plugin.databaseManager.setCurrentBook(selectedBookId);
        });

        // 단어장 생성 이벤트 리스너
        document.addEventListener('bookCreated', this.handleBookCreated.bind(this));

        // 제목
        const titleEl = contentEl.createEl('h2', { text: '단어 추가', cls: 'modal-title' });
        
        // 설명
        const descriptionEl = contentEl.createEl('p', { 
            text: '추가할 영단어들을 입력하세요. 각 단어는 새 줄로 구분됩니다.',
            cls: 'modal-description'
        });

        // 입력 영역
        const inputSection = contentEl.createEl('div', { cls: 'input-section' });
        
        const textarea = inputSection.createEl('textarea', {
            placeholder: 'beautiful\nhappy\nlearn\nstudy\nwork\n...',
            cls: 'words-textarea'
        });
        textarea.setAttribute('rows', '10');

        // 예시 버튼
        const exampleBtn = inputSection.createEl('button', { 
            text: '예시 단어들 불러오기',
            cls: 'example-button'
        });
        exampleBtn.addEventListener('click', () => {
            textarea.value = 'beautiful\nhappy\nlearn\nstudy\nwork\nimportant\nsuccess\nknowledge\nexperience\nfreedom';
        });

        // 버튼 영역
        const buttonSection = contentEl.createEl('div', { cls: 'button-section' });
        
        const addButton = buttonSection.createEl('button', { 
            text: '단어 추가',
            cls: 'add-button primary'
        });
        addButton.addEventListener('click', () => this.addWords(textarea.value, this.bookSelect.value));

        const cancelButton = buttonSection.createEl('button', { 
            text: '취소',
            cls: 'cancel-button'
        });
        cancelButton.addEventListener('click', () => {
            if (this.isProcessing) {
                this.cancelOperation();
            } else {
                this.close();
            }
        });

        // 진행 상황 표시 영역
        const progressSection = contentEl.createEl('div', { cls: 'progress-section' });
        progressSection.style.display = 'none';
        
        const progressText = progressSection.createEl('p', { 
            text: '단어를 추가하는 중...',
            cls: 'progress-text'
        });
        
        const progressBar = progressSection.createEl('div', { cls: 'progress-bar' });
        const progressFill = progressBar.createEl('div', { cls: 'progress-fill' });

        // 결과 표시 영역
        const resultSection = contentEl.createEl('div', { cls: 'result-section' });
        resultSection.style.display = 'none';

        // Enter 키로 추가 가능하도록
        textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.addWords(textarea.value, this.bookSelect.value);
            }
        });

        // 포커스 설정
        textarea.focus();
    }

    private async addWords(inputText: string, bookId: string) {
        if (this.isProcessing) return;

        const words = this.parseWords(inputText);
        if (words.length === 0) {
            new Notice('추가할 단어를 입력해주세요.');
            return;
        }

        this.isProcessing = true;
        this.cancellationTokenSource = new CancellationTokenSource();
        this.showProgress(words.length);
        this.updateCancelButton(true);

        const results = {
            success: [] as string[],
            failed: [] as string[],
            alreadyExists: [] as string[]
        };

        try {
            await processBatchWithCancellation(
                words,
                async (word: string, index: number) => {
                    // 이미 존재하는지 확인
                    const existingWord = this.plugin.databaseManager.getWord(word);
                    if (existingWord) {
                        results.alreadyExists.push(word);
                        return;
                    }

                    try {
                        // 단어 데이터 가져오기
                        const wordData = await this.wordService.getWordData(word);
                        
                        // WordData를 VocabularyCard로 변환
                        const vocabularyCard = {
                            ...wordData,
                            reviewCount: 0,
                            difficulty: 'good' as const,
                            lastReviewed: null,
                            addedDate: new Date().toISOString(),
                            bookId: bookId
                        };
                        
                        // 데이터베이스에 추가
                        await this.plugin.databaseManager.addWord(vocabularyCard);
                        results.success.push(word);
                    } catch (error) {
                        results.failed.push(word);
                        console.error(`단어 "${word}" 추가 실패:`, error);
                    }
                },
                {
                    batchSize: getConfigValue<number>(CONFIG_PATHS.BATCH_DEFAULT_SIZE),
                    delay: getConfigValue<number>(CONFIG_PATHS.BATCH_DELAY),
                    cancellationToken: this.cancellationTokenSource.token,
                    onProgress: (current, total) => {
                        this.updateProgress(current, total, `처리 중... (${current}/${total})`);
                    }
                }
            );
        } catch (error) {
            if (error instanceof CancellationError) {
                new Notice('작업이 취소되었습니다.');
            } else {
                console.error('배치 처리 중 오류:', error);
                new Notice('단어 추가 중 오류가 발생했습니다.');
            }
        } finally {
            this.isProcessing = false;
            this.cancellationTokenSource?.dispose();
            this.cancellationTokenSource = null;
            this.hideProgress();
            this.updateCancelButton(false);
            this.showResults(results);
        }
    }

    private parseWords(inputText: string): string[] {
        // 입력 텍스트 정제
        const sanitizedInput = sanitizeMarkdown(inputText);
        
        const rawWords = sanitizedInput
            .split('\n')
            .map(word => word.trim())
            .filter(word => word.length > 0);

        // 단어 검증 및 정제
        const validation = validateBatch(rawWords, (word) => validateWord(word));
        
        // 유효하지 않은 단어가 있으면 사용자에게 알림
        if (validation.invalid.length > 0) {
            const invalidWords = validation.invalid.slice(0, 5).map(item => item.item).join(', ');
            const moreCount = validation.invalid.length > 5 ? ` 외 ${validation.invalid.length - 5}개` : '';
            new Notice(`유효하지 않은 단어가 제외되었습니다: ${invalidWords}${moreCount}`);
        }

        // 유효한 단어들만 반환 (중복 제거)
        const validWords = validation.valid
            .map(word => validateWord(word).sanitized!)
            .map(word => word.toLowerCase())
            .filter((word, index, array) => array.indexOf(word) === index);

        return validWords;
    }

    private showProgress(totalWords: number) {
        const progressSection = this.contentEl.querySelector('.progress-section') as HTMLElement;
        const progressText = progressSection.querySelector('.progress-text') as HTMLElement;
        
        progressSection.style.display = 'block';
        progressText.textContent = `단어를 추가하는 중... (0/${totalWords})`;
    }

    private updateProgress(current: number, total: number, message: string) {
        const progressSection = this.contentEl.querySelector('.progress-section') as HTMLElement;
        const progressText = progressSection.querySelector('.progress-text') as HTMLElement;
        const progressFill = progressSection.querySelector('.progress-fill') as HTMLElement;
        
        const percentage = (current / total) * 100;
        progressText.textContent = `${message} (${current}/${total})`;
        progressFill.style.width = `${percentage}%`;
    }

    private hideProgress() {
        const progressSection = this.contentEl.querySelector('.progress-section') as HTMLElement;
        progressSection.style.display = 'none';
    }

    private showResults(results: { success: string[]; failed: string[]; alreadyExists: string[] }) {
        const resultSection = this.contentEl.querySelector('.result-section') as HTMLElement;
        resultSection.style.display = 'block';
        resultSection.empty();

        const totalProcessed = results.success.length + results.failed.length + results.alreadyExists.length;
        
        // 결과 요약
        const summaryEl = resultSection.createEl('div', { cls: 'results-summary' });
        
        if (results.success.length > 0) {
            const successEl = summaryEl.createEl('div', { cls: 'result-item success' });
            successEl.createEl('span', { 
                text: `✅ 성공: ${results.success.length}개`,
                cls: 'result-count'
            });
            if (results.success.length <= 5) {
                successEl.createEl('p', { 
                    text: results.success.join(', '),
                    cls: 'result-words'
                });
            }
        }

        if (results.alreadyExists.length > 0) {
            const existsEl = summaryEl.createEl('div', { cls: 'result-item warning' });
            existsEl.createEl('span', { 
                text: `⚠️ 이미 존재: ${results.alreadyExists.length}개`,
                cls: 'result-count'
            });
            if (results.alreadyExists.length <= 5) {
                existsEl.createEl('p', { 
                    text: results.alreadyExists.join(', '),
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
            if (results.failed.length <= 5) {
                failedEl.createEl('p', { 
                    text: results.failed.join(', '),
                    cls: 'result-words'
                });
            }
        }

        // 버튼들
        const buttonSection = resultSection.createEl('div', { cls: 'result-buttons' });
        
        const closeButton = buttonSection.createEl('button', { 
            text: '닫기',
            cls: 'close-button'
        });
        closeButton.addEventListener('click', () => this.close());

        const addMoreButton = buttonSection.createEl('button', { 
            text: '더 추가하기',
            cls: 'add-more-button'
        });
        addMoreButton.addEventListener('click', () => {
            resultSection.style.display = 'none';
            const textarea = this.contentEl.querySelector('.words-textarea') as HTMLTextAreaElement;
            textarea.value = '';
            textarea.focus();
        });

        // 성공한 단어가 있으면 알림
        if (results.success.length > 0) {
            new Notice(`${results.success.length}개의 단어가 성공적으로 추가되었습니다!`);
        }
    }

    private cancelOperation(): void {
        if (this.cancellationTokenSource) {
            this.cancellationTokenSource.cancel();
            new Notice('작업 취소 중...');
        }
    }

    private updateCancelButton(isProcessing: boolean): void {
        const cancelButton = this.contentEl.querySelector('.cancel-button') as HTMLButtonElement;
        if (cancelButton) {
            cancelButton.textContent = isProcessing ? '작업 취소' : '취소';
            cancelButton.classList.toggle('danger', isProcessing);
        }
    }

    onClose() {
        // 진행 중인 작업 취소
        if (this.isProcessing && this.cancellationTokenSource) {
            this.cancellationTokenSource.cancel();
        }
        
        this.isProcessing = false;
        this.cancellationTokenSource?.dispose();
        this.cancellationTokenSource = null;
        
        const { contentEl } = this;
        contentEl.empty();
        
        // 이벤트 리스너 제거
        document.removeEventListener('bookCreated', this.handleBookCreated.bind(this));
    }

    private openAddBookModal() {
        new AddBookModal(this.app, this.plugin).open();
    }

    private async handleBookCreated(event: CustomEvent) {
        await this.updateBookSelect();
    }

    private async updateBookSelect() {
        // 데이터베이스에서 최신 데이터 로드
        await this.plugin.databaseManager.loadAllBooks();
        
        const books = this.plugin.databaseManager.getAllBooks();
        this.bookSelect.innerHTML = '';
        books.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.text = book.name;
            this.bookSelect.appendChild(option);
        });
    }
} 