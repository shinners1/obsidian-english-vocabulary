import { IBookRepository } from '../../../core/ports/IBookRepository';
import { Book } from '../../../core/entities/Book';

export interface BookSelectorDependencies {
    bookRepository: IBookRepository;
}

export interface BookSelectorOptions {
    showAddButton?: boolean;
    showDeleteButton?: boolean;
    onBookChange?: (bookId: string) => void;
    onBookCreated?: (book: Book) => void;
    onBookDeleted?: (bookId: string) => void;
}

export class BookSelector {
    private dependencies: BookSelectorDependencies;
    private options: BookSelectorOptions;
    private selectElement: HTMLSelectElement;
    private container: HTMLElement;

    constructor(dependencies: BookSelectorDependencies, options: BookSelectorOptions = {}) {
        this.dependencies = dependencies;
        this.options = options;
    }

    async render(container: HTMLElement): Promise<void> {
        this.container = container;
        container.empty();
        container.addClass('book-selector');

        const headerEl = container.createEl('div', { cls: 'book-selector-header' });
        headerEl.style.display = 'flex';
        headerEl.style.alignItems = 'center';
        headerEl.style.gap = '18px';
        headerEl.style.marginBottom = '18px';

        // 단어장 선택 드롭다운
        this.selectElement = headerEl.createEl('select', { cls: 'book-select-dropdown' });
        this.selectElement.style.height = '38px';
        this.selectElement.style.fontSize = '16px';

        await this.updateBookList();

        this.selectElement.addEventListener('change', async (e) => {
            const selectedBookId = (e.target as HTMLSelectElement).value;
            await this.dependencies.bookRepository.setCurrentBook(selectedBookId);
            this.options.onBookChange?.(selectedBookId);
        });

        // 단어장 추가 버튼
        if (this.options.showAddButton) {
            const addBookBtn = headerEl.createEl('button', { 
                text: '새 단어장 추가', 
                cls: 'book-manage-button' 
            });
            addBookBtn.addEventListener('click', () => this.showAddBookModal());
        }

        // 단어장 삭제 버튼
        if (this.options.showDeleteButton) {
            const deleteBookBtn = headerEl.createEl('button', { 
                text: '현재 단어장 삭제', 
                cls: 'book-delete-button' 
            });
            deleteBookBtn.addEventListener('click', () => this.showDeleteConfirmation());
        }

        // 이벤트 리스너 등록
        document.addEventListener('bookCreated', this.handleBookCreated);
    }

    private async updateBookList(): Promise<void> {
        const books = await this.dependencies.bookRepository.findAll();
        const currentBook = await this.dependencies.bookRepository.getCurrentBook();

        this.selectElement.empty();

        books.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.text = book.name;
            if (book.id === currentBook?.id) option.selected = true;
            this.selectElement.appendChild(option);
        });
    }

    private showAddBookModal(): void {
        // AddBookModal을 동적으로 import하여 사용
        import('./AddBookModal').then(({ AddBookModal }) => {
            const modal = new AddBookModal(
                // @ts-ignore - app 인스턴스는 전역에서 접근 가능
                app,
                this.dependencies
            );
            modal.open();
        });
    }

    private async showDeleteConfirmation(): Promise<void> {
        const currentBook = await this.dependencies.bookRepository.getCurrentBook();
        if (!currentBook || currentBook.id === 'default') {
            // 기본 단어장은 삭제할 수 없음
            return;
        }

        const confirmModal = new ConfirmModal(
            // @ts-ignore - app 인스턴스는 전역에서 접근 가능
            app,
            '단어장 삭제 확인',
            `정말로 "${currentBook.name}" 단어장을 삭제하시겠습니까?\n\n` +
            `⚠️ 이 작업은 되돌릴 수 없으며, 단어장과 모든 단어가 영구적으로 삭제됩니다.`,
            async () => {
                try {
                    await this.dependencies.bookRepository.remove(currentBook.id);
                    await this.dependencies.bookRepository.setCurrentBook('default');
                    await this.updateBookList();
                    this.options.onBookDeleted?.(currentBook.id);
                } catch (error) {
                    console.error('단어장 삭제 실패:', error);
                }
            }
        );
        confirmModal.open();
    }

    private handleBookCreated = async (event: CustomEvent) => {
        const newBook = event.detail as Book;
        await this.dependencies.bookRepository.setCurrentBook(newBook.id);
        await this.updateBookList();
        this.options.onBookCreated?.(newBook);
    };

    getCurrentBookId(): string {
        return this.selectElement.value;
    }

    async refresh(): Promise<void> {
        await this.updateBookList();
    }

    destroy(): void {
        document.removeEventListener('bookCreated', this.handleBookCreated);
    }
}

// 임시 ConfirmModal (나중에 shared/ui로 이동)
class ConfirmModal {
    private app: any;
    private title: string;
    private message: string;
    private onConfirm: () => void;

    constructor(app: any, title: string, message: string, onConfirm: () => void) {
        this.app = app;
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    open(): void {
        // 임시 구현 - 나중에 실제 Modal로 교체
        const confirmed = confirm(`${this.title}\n\n${this.message}`);
        if (confirmed) {
            this.onConfirm();
        }
    }
} 