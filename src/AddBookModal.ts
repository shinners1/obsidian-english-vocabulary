import { Modal, App, Notice } from 'obsidian';
import EnglishVocabularyPlugin from './main';

export class AddBookModal extends Modal {
    plugin: EnglishVocabularyPlugin;

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('add-book-modal');

        // 제목
        const titleEl = contentEl.createEl('h2', { text: '단어장 추가', cls: 'modal-title' });
        
        // 설명
        const descriptionEl = contentEl.createEl('p', { 
            text: '새로운 단어장을 생성합니다.',
            cls: 'modal-description'
        });

        // 입력 폼
        const formEl = contentEl.createEl('form', { cls: 'book-form' });
        
        // 단어장 이름 입력
        const nameSection = formEl.createEl('div', { cls: 'form-section' });
        const nameLabel = nameSection.createEl('label', { 
            text: '단어장 이름 *',
            cls: 'form-label'
        });
        const nameInput = nameSection.createEl('input', {
            type: 'text',
            placeholder: '예: TOEIC 단어장, 일상생활 단어장',
            cls: 'form-input'
        });
        nameInput.required = true;

        // 단어장 설명 입력
        const descSection = formEl.createEl('div', { cls: 'form-section' });
        const descLabel = descSection.createEl('label', { 
            text: '설명 (선택사항)',
            cls: 'form-label'
        });
        const descInput = descSection.createEl('textarea', {
            placeholder: '단어장에 대한 설명을 입력하세요.',
            cls: 'form-textarea'
        });
        descInput.rows = 3;

        // 버튼 영역
        const buttonSection = formEl.createEl('div', { cls: 'button-section' });
        
        const createButton = buttonSection.createEl('button', { 
            text: '단어장 생성',
            cls: 'create-button primary',
            type: 'submit'
        });

        const cancelButton = buttonSection.createEl('button', { 
            text: '취소',
            cls: 'cancel-button',
            type: 'button'
        });
        cancelButton.addEventListener('click', () => this.close());

        // 폼 제출 이벤트
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createBook(nameInput.value.trim(), descInput.value.trim());
        });

        // Enter 키로 제출 가능하도록
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                formEl.dispatchEvent(new Event('submit'));
            }
        });

        // 포커스 설정
        nameInput.focus();
    }

    private async createBook(name: string, description: string) {
        if (!name.trim()) {
            new Notice('단어장 이름을 입력해주세요.');
            return;
        }

        try {
            // 기존 단어장과 이름 중복 확인
            const existingBooks = this.plugin.databaseManager.getAllBooks();
            const isDuplicate = existingBooks.some(book => 
                book.name.toLowerCase() === name.toLowerCase()
            );

            if (isDuplicate) {
                new Notice('이미 존재하는 단어장 이름입니다.');
                return;
            }

            // 단어장 생성
            const newBook = await this.plugin.databaseManager.createBook(name, description);
            
            new Notice(`"${name}" 단어장이 성공적으로 생성되었습니다!`);
            
            // 모달 닫기
            this.close();
            
            // 모든 모달에서 수신할 수 있도록 이벤트 발생
            const event = new CustomEvent('bookCreated', { detail: newBook });
            document.dispatchEvent(event);

        } catch (error) {
            console.error('단어장 생성 실패:', error);
            new Notice('단어장 생성에 실패했습니다.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 