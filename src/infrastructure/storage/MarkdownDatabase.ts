import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { VocabularyCard, VocabularyCardData } from '../../core/entities/Vocabulary';
import { Book, BookData } from '../../core/entities/Book';

export class MarkdownDatabase {
    constructor(
        private app: App,
        private vocabularyFolderPath: string = 'Vocabulary'
    ) {
        this.initializeVocabularyFolder();
    }

    // 단어장 폴더 초기화
    private async initializeVocabularyFolder(): Promise<void> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.vocabularyFolderPath);
            
            if (folder instanceof TFolder) {
                return; // 이미 존재
            }
            
            await this.app.vault.createFolder(this.vocabularyFolderPath);
            
        } catch (error) {
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (errorMessage.includes('already exists') || 
                    errorMessage.includes('folder already exists') ||
                    errorMessage.includes('already present')) {
                    console.log('단어장 폴더가 이미 존재합니다:', this.vocabularyFolderPath);
                } else {
                    console.warn('단어장 폴더 생성 실패:', error);
                }
            }
        }
    }

    // Book을 MD 파일로 저장
    async saveBookToFile(book: Book): Promise<void> {
        const fileName = `${book.name.replace(/[<>:"/\\|?*]/g, '_')}.md`;
        const filePath = normalizePath(`${this.vocabularyFolderPath}/${fileName}`);
        
        // 해당 book의 단어들 가져오기 (나중에 Repository에서 주입받도록 수정 예정)
        const bookWords: VocabularyCard[] = []; // 임시로 빈 배열

        // YAML frontmatter 생성
        const frontmatter = [
            '---',
            `bookId: ${book.id}`,
            `name: "${book.name}"`,
            `description: "${book.description}"`,
            `createdAt: ${book.createdAt}`,
            `updatedAt: ${book.updatedAt}`,
            `wordCount: ${bookWords.length}`,
            `isDefault: ${book.isDefault}`,
            '---',
            ''
        ].join('\n');

        // 마크다운 콘텐츠 생성
        let content = frontmatter;
        content += `# ${book.name}\n\n`;
        content += `${book.description}\n\n`;
        content += `## 단어 목록 (${bookWords.length}개)\n\n`;

        for (const word of bookWords) {
            content += this.generateWordMarkdown(word);
        }

        await this.writeFile(filePath, content);
    }

    // 단어를 해당 Book 파일에 저장
    async saveWordToFile(card: VocabularyCard): Promise<void> {
        // 단어장 파일 찾기
        const bookFile = await this.findBookFile(card.bookId);
        if (!bookFile) {
            throw new Error(`단어장 파일을 찾을 수 없습니다: ${card.bookId}`);
        }

        const content = await this.app.vault.read(bookFile);
        const updatedContent = this.updateWordInContent(content, card);
        await this.app.vault.modify(bookFile, updatedContent);
    }

    // 단어를 Book 파일에서 제거
    async removeWordFromFile(card: VocabularyCard): Promise<void> {
        const bookFile = await this.findBookFile(card.bookId);
        if (!bookFile) {
            return; // 파일이 없으면 무시
        }

        const content = await this.app.vault.read(bookFile);
        const updatedContent = this.removeWordFromContent(content, card.word);
        await this.app.vault.modify(bookFile, updatedContent);
    }

    // 여러 단어를 한 번에 저장
    async saveManyWordsToFiles(cards: VocabularyCard[]): Promise<void> {
        // 단어장별로 그룹화
        const cardsByBook = new Map<string, VocabularyCard[]>();
        for (const card of cards) {
            if (!cardsByBook.has(card.bookId)) {
                cardsByBook.set(card.bookId, []);
            }
            cardsByBook.get(card.bookId)!.push(card);
        }

        // 각 단어장 파일 업데이트
        for (const [bookId, bookCards] of cardsByBook) {
            const bookFile = await this.findBookFile(bookId);
            if (!bookFile) continue;

            let content = await this.app.vault.read(bookFile);
            for (const card of bookCards) {
                content = this.updateWordInContent(content, card);
            }
            await this.app.vault.modify(bookFile, content);
        }
    }

    // 여러 단어를 한 번에 제거
    async removeManyWordsFromFiles(cards: VocabularyCard[]): Promise<void> {
        const cardsByBook = new Map<string, VocabularyCard[]>();
        for (const card of cards) {
            if (!cardsByBook.has(card.bookId)) {
                cardsByBook.set(card.bookId, []);
            }
            cardsByBook.get(card.bookId)!.push(card);
        }

        for (const [bookId, bookCards] of cardsByBook) {
            const bookFile = await this.findBookFile(bookId);
            if (!bookFile) continue;

            let content = await this.app.vault.read(bookFile);
            for (const card of bookCards) {
                content = this.removeWordFromContent(content, card.word);
            }
            await this.app.vault.modify(bookFile, content);
        }
    }

    // 모든 단어 로드
    async loadAllWords(): Promise<VocabularyCardData[]> {
        const words: VocabularyCardData[] = [];
        const files = await this.getAllBookFiles();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const { frontmatter } = this.parseMDFile(content);
                
                if (frontmatter.bookId) {
                    const bookWords = this.parseWordsFromMarkdown(content, frontmatter.bookId);
                    words.push(...bookWords);
                }
            } catch (error) {
                console.error(`파일 로드 실패: ${file.path}`, error);
            }
        }

        return words;
    }

    // 모든 단어를 파일에 저장
    async saveAllWordsToFiles(cards: VocabularyCard[]): Promise<void> {
        await this.saveManyWordsToFiles(cards);
    }

    // 모든 Book 로드
    async loadAllBooks(): Promise<BookData[]> {
        const books: BookData[] = [];
        const files = await this.getAllBookFiles();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const { frontmatter } = this.parseMDFile(content);
                
                if (frontmatter.bookId) {
                    const book: BookData = {
                        id: frontmatter.bookId,
                        name: frontmatter.name || file.basename,
                        description: frontmatter.description || '',
                        createdAt: frontmatter.createdAt || new Date().toISOString(),
                        updatedAt: frontmatter.updatedAt || new Date().toISOString(),
                        wordCount: frontmatter.wordCount || 0,
                        isDefault: frontmatter.isDefault || false
                    };
                    books.push(book);
                }
            } catch (error) {
                console.error(`Book 파일 로드 실패: ${file.path}`, error);
            }
        }

        return books;
    }

    // Book 파일 삭제
    async deleteBookFile(bookId: string): Promise<void> {
        const bookFile = await this.findBookFile(bookId);
        if (bookFile) {
            await this.app.vault.delete(bookFile);
        }
    }

    // 유틸리티 메서드들
    private async findBookFile(bookId: string): Promise<TFile | null> {
        const files = await this.getAllBookFiles();
        
        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const { frontmatter } = this.parseMDFile(content);
                if (frontmatter.bookId === bookId) {
                    return file;
                }
            } catch (error) {
                console.error(`파일 검색 중 오류: ${file.path}`, error);
            }
        }
        
        return null;
    }

    private async getAllBookFiles(): Promise<TFile[]> {
        const folder = this.app.vault.getAbstractFileByPath(this.vocabularyFolderPath);
        if (!(folder instanceof TFolder)) {
            return [];
        }

        return folder.children
            .filter(file => file instanceof TFile && file.extension === 'md')
            .map(file => file as TFile);
    }

    private async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('already exists')) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.app.vault.modify(file, content);
                }
            } else {
                throw error;
            }
        }
    }

    private generateWordMarkdown(word: VocabularyCard): string {
        let content = `### ${word.word}\n\n`;
        
        if (word.pronunciation) {
            content += `**발음:** ${word.pronunciation}\n\n`;
        }
        
        content += `**뜻:**\n`;
        for (const meaning of word.meanings) {
            content += `- ${meaning}\n`;
        }
        content += '\n';
        
        if (word.similarWords.length > 0) {
            content += `**유사한 단어:** ${word.similarWords.join(', ')}\n\n`;
        }
        
        if (word.examples.length > 0) {
            content += `**예문:**\n`;
            for (const example of word.examples) {
                content += `- ${example.english}\n`;
                content += `  - ${example.korean}\n`;
            }
            content += '\n';
        }
        
        content += `**복습 정보:**\n`;
        content += `- 복습 횟수: ${word.reviewCount}\n`;
        content += `- 난이도: ${word.difficulty}\n`;
        content += `- 마지막 복습: ${word.lastReviewed || '없음'}\n`;
        content += `- 추가일: ${word.addedDate}\n\n`;
        content += '---\n\n';

        return content;
    }

    private updateWordInContent(content: string, card: VocabularyCard): string {
        const wordMarkdown = this.generateWordMarkdown(card);
        const wordSectionRegex = new RegExp(`### ${card.word}\\s*\\n[\\s\\S]*?(?=### |$)`, 'i');
        
        if (wordSectionRegex.test(content)) {
            // 기존 단어 업데이트
            return content.replace(wordSectionRegex, wordMarkdown);
        } else {
            // 새 단어 추가
            return content + wordMarkdown;
        }
    }

    private removeWordFromContent(content: string, word: string): string {
        const wordSectionRegex = new RegExp(`### ${word}\\s*\\n[\\s\\S]*?(?=### |$)`, 'i');
        return content.replace(wordSectionRegex, '');
    }

    private parseMDFile(content: string): { frontmatter: any, body: string } {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return { frontmatter: {}, body: content };
        }
        
        const frontmatterText = match[1];
        const body = match[2];
        
        const frontmatter: any = {};
        
        frontmatterText.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                if (value.startsWith('"') && value.endsWith('"')) {
                    frontmatter[key] = value.slice(1, -1);
                } else if (value === 'true') {
                    frontmatter[key] = true;
                } else if (value === 'false') {
                    frontmatter[key] = false;
                } else if (!isNaN(Number(value))) {
                    frontmatter[key] = Number(value);
                } else {
                    frontmatter[key] = value;
                }
            }
        });
        
        return { frontmatter, body };
    }

    private parseWordsFromMarkdown(markdown: string, bookId: string): VocabularyCardData[] {
        const words: VocabularyCardData[] = [];
        const wordSections = markdown.split(/^### /m).slice(1);
        
        for (const section of wordSections) {
            const word = this.parseWordSection(section, bookId);
            if (word) {
                words.push(word);
            }
        }
        
        return words;
    }

    private parseWordSection(section: string, bookId: string): VocabularyCardData | null {
        const lines = section.split('\n');
        if (lines.length === 0) return null;
        
        const word = lines[0].trim();
        if (!word) return null;
        
        const result: VocabularyCardData = {
            word,
            pronunciation: '',
            meanings: [],
            similarWords: [],
            examples: [],
            reviewCount: 0,
            difficulty: 'good' as const,
            lastReviewed: null,
            addedDate: new Date().toISOString(),
            bookId
        };
        
        let currentSection = '';
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('**발음:**')) {
                result.pronunciation = line.replace('**발음:**', '').trim();
            } else if (line.startsWith('**뜻:**')) {
                currentSection = 'meanings';
            } else if (line.startsWith('**유사한 단어:**')) {
                result.similarWords = line.replace('**유사한 단어:**', '').split(',').map(s => s.trim());
            } else if (line.startsWith('**예문:**')) {
                currentSection = 'examples';
            } else if (line.startsWith('**복습 정보:**')) {
                currentSection = 'review';
            } else if (line.startsWith('- ') && currentSection === 'meanings') {
                result.meanings.push(line.substring(2));
            } else if (line.startsWith('- ') && currentSection === 'examples') {
                const english = line.substring(2);
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
                    const korean = lines[i + 1].trim().substring(2);
                    result.examples.push({ english, korean });
                    i++; // 다음 줄 건너뛰기
                }
            } else if (currentSection === 'review') {
                if (line.includes('복습 횟수:')) {
                    result.reviewCount = parseInt(line.split(':')[1]) || 0;
                } else if (line.includes('난이도:')) {
                    const difficulty = line.split(':')[1]?.trim();
                    if (difficulty === 'easy' || difficulty === 'good' || difficulty === 'hard') {
                        result.difficulty = difficulty;
                    }
                } else if (line.includes('마지막 복습:')) {
                    const lastReviewed = line.split(':')[1]?.trim();
                    result.lastReviewed = lastReviewed !== '없음' ? lastReviewed : null;
                } else if (line.includes('추가일:')) {
                    result.addedDate = line.split(':')[1]?.trim() || result.addedDate;
                }
            }
        }
        
        return result;
    }
} 