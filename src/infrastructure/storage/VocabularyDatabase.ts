import { VocabularyCard, Book } from '../../VocabularyCard';
import { App, TFile, TFolder, normalizePath } from 'obsidian';

export interface DatabaseData {
    books: Book[];
    words: VocabularyCard[];
    settings: {
        dailyGoal: number;
        reviewInterval: number;
        currentBookId: string;
    };
    statistics: {
        totalReviews: number;
        streakDays: number;
        lastStudyDate: string | null;
    };
}

export class VocabularyDatabaseManager {
    private app: App;
    private books: Map<string, Book> = new Map();
    private words: Map<string, VocabularyCard> = new Map();
    private settings = {
        dailyGoal: 10,
        reviewInterval: 1,
        currentBookId: 'default'
    };
    private statistics = {
        totalReviews: 0,
        streakDays: 0,
        lastStudyDate: null as string | null
    };
    private saveCallback: () => void;
    private vocabularyFolderPath = 'Vocabulary';

    constructor(app: App, saveCallback: () => void, folderPath?: string) {
        this.app = app;
        this.saveCallback = saveCallback;
        if (folderPath) {
            this.vocabularyFolderPath = folderPath;
        }
        this.initializeVocabularyFolder();
        this.initializeDefaultBook();
    }

    // 단어장 폴더 초기화
    private async initializeVocabularyFolder() {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.vocabularyFolderPath);
            
            // 폴더가 이미 존재하고 TFolder 인스턴스인 경우
            if (folder instanceof TFolder) {
                return; // 이미 존재하므로 아무것도 하지 않음
            }
            
            // 폴더가 존재하지 않는 경우에만 생성
            await this.app.vault.createFolder(this.vocabularyFolderPath);
            
        } catch (error) {
            // 폴더가 이미 존재하는 경우는 정상적인 상황이므로 경고만 출력
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (errorMessage.includes('already exists') || 
                    errorMessage.includes('folder already exists') ||
                    errorMessage.includes('already present')) {
                    // 단어장 폴더가 이미 존재하는 경우 (정상)
                } else {
                    console.warn('단어장 폴더 생성 실패:', error);
                }
            } else {
                console.warn('단어장 폴더 생성 중 알 수 없는 오류 발생:', error);
            }
        }
    }

    // 기본 book 초기화
    private async initializeDefaultBook() {
        if (!this.books.has('default')) {
            const defaultBook: Book = {
                id: 'default',
                name: '기본 단어장',
                description: '기본 단어장입니다.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                wordCount: 0,
                isDefault: true
            };
            this.books.set('default', defaultBook);
            await this.saveBookToFile(defaultBook);
        }
    }

    // Book을 MD 파일로 저장
    private async saveBookToFile(book: Book): Promise<void> {
        const bookName = typeof book.name === 'string' ? book.name : 'untitled';
        const fileName = `${bookName.replace(/[<>:"/\\|?*]/g, '_')}.md`;
        const filePath = normalizePath(`${this.vocabularyFolderPath}/${fileName}`);
        
        // 해당 book의 단어들 가져오기
        const bookWords = Array.from(this.words.values())
            .filter(word => word.bookId === book.id)
            .sort((a, b) => {
                const wordA = typeof a.word === 'string' ? a.word : '';
                const wordB = typeof b.word === 'string' ? b.word : '';
                return wordA.localeCompare(wordB);
            });

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
            content += `### ${word.word}\n\n`;
            
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
            
            // 복습 정보
            content += `**복습 정보:**\n`;
            content += `- 복습 횟수: ${word.reviewCount}\n`;
            content += `- 난이도: ${word.difficulty}\n`;
            content += `- 마지막 복습: ${word.lastReviewed || '없음'}\n`;
            content += `- 추가일: ${word.addedDate}\n`;
            
            // 스페이스드 리피티션 정보
            if (word.scheduleInfo) {
                content += `\n**스페이스드 리피티션:**\n`;
                content += `- 다음 복습일: ${word.scheduleInfo.dueDate}\n`;
                content += `- 복습 간격: ${word.scheduleInfo.interval}일\n`;
                content += `- 용이도: ${word.scheduleInfo.ease}\n`;
                content += `- 실패 횟수: ${word.scheduleInfo.lapseCount}\n`;
            }
            
            content += '\n---\n\n';
        }

        try {
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                try {
                    await this.app.vault.create(filePath, content);
                } catch (error) {
                    // 파일이 이미 존재한다면 modify로 재시도
                    if (error instanceof Error && error.message.includes('already exists')) {
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file instanceof TFile) {
                            await this.app.vault.modify(file, content);
                        } else {
                            // 파일이 이미 존재하지만 TFile이 아닌 경우 (예: 폴더)
                            // 이는 정상적인 상황일 수 있으므로 조용히 처리
                        }
                    } else {
                        console.error('단어장 파일 저장 실패:', error);
                    }
                }
            }
        } catch (error) {
            console.error('단어장 파일 저장 실패:', error);
        }
    }

    // MD 파일에서 Book과 단어들 로드
    private async loadBookFromFile(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const { frontmatter, body } = this.parseMDFile(content);
            
            if (!frontmatter.bookId) return;

            // Book 정보 복원
            const book: Book = {
                id: frontmatter.bookId,
                name: frontmatter.name || file.basename,
                description: frontmatter.description || '',
                createdAt: frontmatter.createdAt || new Date().toISOString(),
                updatedAt: frontmatter.updatedAt || new Date().toISOString(),
                wordCount: frontmatter.wordCount || 0,
                isDefault: frontmatter.isDefault || false
            };
            
            this.books.set(book.id, book);

            // 단어들 파싱
            const words = this.parseWordsFromMarkdown(body, book.id);
            for (const word of words) {
                this.words.set(word.word.toLowerCase(), word);
            }
        } catch (error) {
            console.error('단어장 파일 로드 실패:', error);
        }
    }

    // MD 파일 파싱 (frontmatter와 body 분리)
    private parseMDFile(content: string): { frontmatter: any, body: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return { frontmatter: {}, body: content };
        }
        
        const frontmatterText = match[1];
        const body = match[2];
        
        // 간단한 YAML 파싱
        const frontmatter: any = {};
        const lines = frontmatterText.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                // 따옴표 제거
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                
                // 타입 변환
                if (value === 'true') frontmatter[key] = true;
                else if (value === 'false') frontmatter[key] = false;
                else if (!isNaN(Number(value))) frontmatter[key] = Number(value);
                else frontmatter[key] = value;
            }
        }
        
        return { frontmatter, body };
    }

    // 마크다운에서 단어들 파싱
    private parseWordsFromMarkdown(markdown: string, bookId: string): VocabularyCard[] {
        const words: VocabularyCard[] = [];
        const wordSections = markdown.split('---').filter(section => section.trim());
        
        for (const section of wordSections) {
            const word = this.parseWordSection(section, bookId);
            if (word) {
                words.push(word);
            }
        }
        
        return words;
    }

    // 개별 단어 섹션 파싱
    private parseWordSection(section: string, bookId: string): VocabularyCard | null {
        const lines = section.split('\n').filter(line => line.trim());
        if (lines.length === 0) return null;
        
        let word = '';
        let pronunciation = '';
        const meanings: string[] = [];
        const similarWords: string[] = [];
        const examples: { english: string; korean: string }[] = [];
        let reviewCount = 0;
        let difficulty: 'none' | 'easy' | 'good' | 'hard' = 'none'; // 초기 난이도 (학습 전)
        let lastReviewed: string | null = null;
        let addedDate = new Date().toISOString();
        let scheduleInfo: any = undefined;
        
        let currentSection = '';
        let currentExample: { english?: string; korean?: string } = {};
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 단어명 추출 (### 헤더)
            if (trimmedLine.startsWith('### ')) {
                word = trimmedLine.substring(4).trim();
                continue;
            }
            
            // 섹션 구분
            if (trimmedLine.startsWith('**발음:**')) {
                pronunciation = trimmedLine.substring(7).trim();
                currentSection = 'pronunciation';
            } else if (trimmedLine.startsWith('**뜻:**')) {
                currentSection = 'meanings';
            } else if (trimmedLine.startsWith('**유사한 단어:**')) {
                const similarWordsText = trimmedLine.substring(12).trim();
                similarWords.push(...similarWordsText.split(',').map(w => w.trim()));
                currentSection = 'similar';
            } else if (trimmedLine.startsWith('**예문:**')) {
                currentSection = 'examples';
            } else if (trimmedLine.startsWith('**복습 정보:**')) {
                currentSection = 'review';
            } else if (trimmedLine.startsWith('**스페이스드 리피티션:**')) {
                currentSection = 'spaced-repetition';
            } else if (currentSection === 'meanings' && trimmedLine.startsWith('- ')) {
                meanings.push(trimmedLine.substring(2).trim());
            } else if (currentSection === 'examples') {
                // 들여쓰기를 고려한 예문 파싱
                if (line.startsWith('- ') && !line.startsWith('  - ')) {
                    // 영어 예문 (들여쓰기 없음)
                    if (currentExample.english && currentExample.korean) {
                        examples.push({
                            english: currentExample.english,
                            korean: currentExample.korean
                        });
                    }
                    currentExample = { english: line.substring(2).trim() };
                } else if (line.startsWith('  - ')) {
                    // 한글 번역 (2칸 들여쓰기)
                    currentExample.korean = line.substring(4).trim();
                }
            } else if (currentSection === 'review') {
                if (trimmedLine.startsWith('- 복습 횟수: ')) {
                    reviewCount = parseInt(trimmedLine.substring(9).trim()) || 0;
                } else if (trimmedLine.startsWith('- 난이도: ')) {
                    const diff = trimmedLine.substring(7).trim();
                    if (diff === 'easy' || diff === 'good' || diff === 'hard') {
                        difficulty = diff;
                    }
                } else if (trimmedLine.startsWith('- 마지막 복습: ')) {
                    const lastRev = trimmedLine.substring(11).trim();
                    lastReviewed = lastRev === '없음' ? null : lastRev;
                } else if (trimmedLine.startsWith('- 추가일: ')) {
                    addedDate = trimmedLine.substring(7).trim();
                }
            } else if (currentSection === 'spaced-repetition') {
                if (!scheduleInfo) {
                    scheduleInfo = {};
                }
                if (trimmedLine.startsWith('- 다음 복습일: ')) {
                    scheduleInfo.dueDate = trimmedLine.substring(10).trim();
                } else if (trimmedLine.startsWith('- 복습 간격: ')) {
                    const intervalText = trimmedLine.substring(8).trim();
                    scheduleInfo.interval = parseInt(intervalText.replace('일', '')) || 1;
                } else if (trimmedLine.startsWith('- 용이도: ')) {
                    scheduleInfo.ease = parseInt(trimmedLine.substring(7).trim()) || 250;
                } else if (trimmedLine.startsWith('- 실패 횟수: ')) {
                    scheduleInfo.lapseCount = parseInt(trimmedLine.substring(9).trim()) || 0;
                }
            }
        }
        
        // 마지막 예문 처리
        if (currentExample.english && currentExample.korean) {
            examples.push({
                english: currentExample.english,
                korean: currentExample.korean
            });
        }
        

        
        if (!word) return null;
        
        return {
            word: word.toLowerCase(),
            pronunciation,
            meanings,
            similarWords,
            examples,
            reviewCount,
            difficulty,
            lastReviewed,
            addedDate,
            bookId,
            scheduleInfo
        };
    }

    // 모든 단어장 파일 로드
    async loadAllBooks(): Promise<void> {
        this.books.clear();
        this.words.clear();
        
        await this.initializeVocabularyFolder();
        await this.initializeDefaultBook();
        
        const folder = this.app.vault.getAbstractFileByPath(this.vocabularyFolderPath);
        if (folder instanceof TFolder) {
            for (const file of folder.children) {
                if (file instanceof TFile && file.extension === 'md') {
                    await this.loadBookFromFile(file);
                }
            }
        }
        
        // 설정 파일 로드
        await this.loadSettings();
    }

    // 설정 파일 저장/로드
    private async saveSettings(): Promise<void> {
        const settingsPath = normalizePath(`${this.vocabularyFolderPath}/settings.json`);
        const data = {
            settings: this.settings,
            statistics: this.statistics
        };
        
        try {
            const existingFile = this.app.vault.getAbstractFileByPath(settingsPath);
            const content = JSON.stringify(data, null, 2);
            
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                await this.app.vault.create(settingsPath, content);
            }
        } catch (error) {
            console.error('설정 파일 저장 실패:', error);
        }
    }

    private async loadSettings(): Promise<void> {
        const settingsPath = normalizePath(`${this.vocabularyFolderPath}/settings.json`);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(settingsPath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const data = JSON.parse(content);
                
                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                }
                if (data.statistics) {
                    this.statistics = { ...this.statistics, ...data.statistics };
                }
            }
        } catch (error) {
            console.warn('설정 파일 로드 실패, 기본값 사용:', error);
        }
    }

    // Book 관리 메서드들
    async createBook(name: string, description: string = ''): Promise<Book> {
        const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const book: Book = {
            id,
            name,
            description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            wordCount: 0,
            isDefault: false
        };
        
        this.books.set(id, book);
        await this.saveBookToFile(book);
        this.saveCallback();
        return book;
    }

    async updateBook(bookId: string, updates: Partial<Book>): Promise<void> {
        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`Book "${bookId}"를 찾을 수 없습니다.`);
        }

        const updatedBook: Book = {
            ...book,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.books.set(bookId, updatedBook);
        await this.saveBookToFile(updatedBook);
        this.saveCallback();
    }

    async deleteBook(bookId: string): Promise<void> {
        if (bookId === 'default') {
            throw new Error('기본 단어장은 삭제할 수 없습니다.');
        }

        const book = this.books.get(bookId);
        if (!book) {
            throw new Error(`Book "${bookId}"를 찾을 수 없습니다.`);
        }

        // book에 속한 모든 단어 삭제
        const wordsToDelete = Array.from(this.words.values())
            .filter(word => word.bookId === bookId)
            .map(word => word.word);
        
        for (const word of wordsToDelete) {
            this.words.delete(word.toLowerCase());
        }

        // book 삭제
        this.books.delete(bookId);

        // 파일 삭제
        const fileName = `${book.name.replace(/[<>:"/\\|?*]/g, '_')}.md`;
        const filePath = normalizePath(`${this.vocabularyFolderPath}/${fileName}`);
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            await this.app.fileManager.trashFile(file);
        }

        // 현재 book이 삭제된 book이면 기본 book으로 변경
        if (this.settings.currentBookId === bookId) {
            this.settings.currentBookId = 'default';
            await this.saveSettings();
        }

        this.saveCallback();
    }

    getAllBooks(): Book[] {
        return Array.from(this.books.values()).sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            
            // name 속성이 문자열인지 확인하고 안전하게 비교
            const nameA = typeof a.name === 'string' ? a.name : '';
            const nameB = typeof b.name === 'string' ? b.name : '';
            
            return nameA.localeCompare(nameB);
        });
    }

    getBook(bookId: string): Book | undefined {
        return this.books.get(bookId);
    }

    getCurrentBook(): Book | undefined {
        return this.books.get(this.settings.currentBookId);
    }

    async setCurrentBook(bookId: string): Promise<void> {
        if (!this.books.has(bookId)) {
            throw new Error(`Book "${bookId}"를 찾을 수 없습니다.`);
        }
        this.settings.currentBookId = bookId;
        await this.saveSettings();
        this.saveCallback();
    }

    // Book별 단어 수 업데이트
    private updateBookWordCount(bookId: string): void {
        const wordCount = Array.from(this.words.values())
            .filter(word => word.bookId === bookId).length;
        
        const book = this.books.get(bookId);
        if (book) {
            book.wordCount = wordCount;
            book.updatedAt = new Date().toISOString();
        }
    }

    // 단어 추가
    async addWord(wordData: VocabularyCard): Promise<void> {
        const word = wordData.word.toLowerCase();
        if (this.words.has(word)) {
            throw new Error(`단어 "${wordData.word}"는 이미 존재합니다.`);
        }

        const newWord: VocabularyCard = {
            ...wordData,
            word: wordData.word.toLowerCase(),
            reviewCount: 0,
            difficulty: 'none', // 초기 난이도 (학습 전)
            lastReviewed: null,
            addedDate: new Date().toISOString(),
            bookId: wordData.bookId || this.settings.currentBookId
        };

        this.words.set(word, newWord);
        
        // 해당 book 파일 업데이트
        const book = this.books.get(newWord.bookId);
        if (book) {
            book.wordCount++;
            book.updatedAt = new Date().toISOString();
            await this.saveBookToFile(book);
        }
        
        this.saveCallback();
    }

    // 단어 삭제
    async removeWord(word: string): Promise<void> {
        const wordKey = word.toLowerCase();
        const wordData = this.words.get(wordKey);
        
        if (!wordData) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        const bookId = wordData.bookId;
        this.words.delete(wordKey);
        
        // 해당 book 파일 업데이트
        const book = this.books.get(bookId);
        if (book) {
            book.wordCount--;
            book.updatedAt = new Date().toISOString();
            await this.saveBookToFile(book);
        }
        
        this.saveCallback();
    }

    // 단어 업데이트 (복습 결과)
    async updateWord(word: string, difficulty: 'easy' | 'good' | 'hard'): Promise<void> {
        const wordKey = word.toLowerCase();
        const wordData = this.words.get(wordKey);
        
        if (!wordData) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        wordData.reviewCount++;
        wordData.difficulty = difficulty;
        wordData.lastReviewed = new Date().toISOString();

        // 통계 업데이트
        this.statistics.totalReviews++;
        this.updateStreak();

        // 해당 book 파일 업데이트
        const book = this.books.get(wordData.bookId);
        if (book) {
            book.updatedAt = new Date().toISOString();
            await this.saveBookToFile(book);
        }
        
        await this.saveSettings();
        this.saveCallback();
    }

    // 단어 업데이트 (복습 결과 + 스페이스드 리피티션 정보)
    async updateWordWithSchedule(
        word: string, 
        difficulty: 'easy' | 'good' | 'hard', 
        scheduleInfo?: any
    ): Promise<void> {
        const wordKey = word.toLowerCase();
        const wordData = this.words.get(wordKey);
        
        if (!wordData) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        wordData.reviewCount++;
        wordData.difficulty = difficulty;
        wordData.lastReviewed = new Date().toISOString();
        
        // 스페이스드 리피티션 정보 업데이트
        if (scheduleInfo) {
            wordData.scheduleInfo = scheduleInfo;
        }

        // 통계 업데이트
        this.statistics.totalReviews++;
        this.updateStreak();

        // 해당 book 파일 업데이트
        const book = this.books.get(wordData.bookId);
        if (book) {
            book.updatedAt = new Date().toISOString();
            await this.saveBookToFile(book);
        }
        
        await this.saveSettings();
        this.saveCallback();
    }

    // 단어 전체 데이터 업데이트 (LLM API로 가져온 정보로 덮어쓰기)
    async updateWordData(word: string, updatedWordData: VocabularyCard): Promise<void> {
        const wordKey = word.toLowerCase();
        const existingWord = this.words.get(wordKey);
        
        if (!existingWord) {
            throw new Error(`단어 "${word}"를 찾을 수 없습니다.`);
        }

        // 기존 단어의 복습 관련 정보는 유지하고, 뜻 정보만 업데이트
        const updatedWord: VocabularyCard = {
            ...updatedWordData,
            word: wordKey,
            reviewCount: existingWord.reviewCount,
            difficulty: existingWord.difficulty,
            lastReviewed: existingWord.lastReviewed,
            addedDate: existingWord.addedDate,
            bookId: existingWord.bookId
        };

        this.words.set(wordKey, updatedWord);
        
        // 해당 book 파일 업데이트
        const book = this.books.get(updatedWord.bookId);
        if (book) {
            book.updatedAt = new Date().toISOString();
            await this.saveBookToFile(book);
        }
        
        this.saveCallback();
    }

    // 단어 조회
    getWord(word: string): VocabularyCard | undefined {
        return this.words.get(word.toLowerCase());
    }

    // 현재 book의 모든 단어 조회
    getAllWords(): VocabularyCard[] {
        return Array.from(this.words.values())
            .filter(word => word.bookId === this.settings.currentBookId)
            .sort((a, b) => {
                const wordA = typeof a.word === 'string' ? a.word : '';
                const wordB = typeof b.word === 'string' ? b.word : '';
                return wordA.localeCompare(wordB);
            });
    }

    // 특정 book의 모든 단어 조회
    getWordsByBook(bookId: string): VocabularyCard[] {
        return Array.from(this.words.values())
            .filter(word => word.bookId === bookId)
            .sort((a, b) => {
                const wordA = typeof a.word === 'string' ? a.word : '';
                const wordB = typeof b.word === 'string' ? b.word : '';
                return wordA.localeCompare(wordB);
            });
    }

    // 복습 대상 단어 조회 (현재 book)
    getWordsForReview(): VocabularyCard[] {
        const now = new Date();
        const reviewIntervalMs = this.settings.reviewInterval * 24 * 60 * 60 * 1000;

        return Array.from(this.words.values())
            .filter(word => word.bookId === this.settings.currentBookId)
            .filter(word => {
                if (!word.lastReviewed) return true;
                
                const lastReview = new Date(word.lastReviewed);
                const timeSinceLastReview = now.getTime() - lastReview.getTime();
                
                return timeSinceLastReview >= reviewIntervalMs;
            });
    }

    // 단어 검색 (현재 book)
    searchWords(query: string): VocabularyCard[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.words.values())
            .filter(word => word.bookId === this.settings.currentBookId)
            .filter(word =>
                word.word.includes(lowerQuery) ||
                word.meanings.some(meaning => meaning.toLowerCase().includes(lowerQuery))
            );
    }

    // 통계 조회 (현재 book)
    getStatistics() {
        const words = Array.from(this.words.values())
            .filter(word => word.bookId === this.settings.currentBookId);
        const totalWords = words.length;
        const totalReviews = this.statistics.totalReviews;
        const averageDifficulty = words.length > 0 
            ? words.reduce((sum, word) => {
                const difficultyValue = word.difficulty === 'easy' ? 1 : 
                                      word.difficulty === 'good' ? 2 : 3;
                return sum + difficultyValue;
            }, 0) / words.length
            : 0;

        const wordsByDifficulty = {
            easy: words.filter(w => w.difficulty === 'easy').length,
            good: words.filter(w => w.difficulty === 'good').length,
            hard: words.filter(w => w.difficulty === 'hard').length
        };

        // 최근 7일 활동 계산
        const recentActivity = this.calculateRecentActivity();

        return {
            totalWords,
            totalReviews,
            streakDays: this.statistics.streakDays,
            averageDifficulty,
            wordsByDifficulty,
            recentActivity
        };
    }

    // 일일 목표 진행률 조회 (현재 book)
    getDailyGoalProgress() {
        const today = new Date().toDateString();
        const todayWords = Array.from(this.words.values())
            .filter(word => word.bookId === this.settings.currentBookId)
            .filter(word => {
                if (!word.lastReviewed) return false;
                return new Date(word.lastReviewed).toDateString() === today;
            }).length;

        const goal = this.settings.dailyGoal;
        const percentage = goal > 0 ? Math.min((todayWords / goal) * 100, 100) : 0;

        return {
            current: todayWords,
            goal: goal,
            percentage: percentage
        };
    }

    // 설정 업데이트
    async updateSettings(newSettings: Partial<typeof this.settings>): Promise<void> {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
        this.saveCallback();
    }

    // 데이터 저장용 형식으로 변환 (호환성 유지)
    getDataForSave(): DatabaseData {
        return {
            books: Array.from(this.books.values()),
            words: Array.from(this.words.values()),
            settings: this.settings,
            statistics: this.statistics
        };
    }

    // 저장된 데이터에서 로드 (호환성 유지)
    async loadFromData(data: DatabaseData): Promise<void> {
        // MD 파일 시스템에서는 이 메서드 대신 loadAllBooks()를 사용
        await this.loadAllBooks();
    }

    // 연속 학습일 업데이트
    private updateStreak(): void {
        const today = new Date().toDateString();
        const lastStudyDate = this.statistics.lastStudyDate 
            ? new Date(this.statistics.lastStudyDate).toDateString()
            : null;

        if (lastStudyDate === today) {
            // 오늘 이미 학습했으면 연속일 증가하지 않음
            return;
        }

        if (!lastStudyDate) {
            // 처음 학습하는 경우
            this.statistics.streakDays = 1;
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            if (lastStudyDate === yesterdayStr) {
                // 어제 학습했으면 연속일 증가
                this.statistics.streakDays++;
            } else {
                // 연속이 끊어진 경우 1로 리셋
                this.statistics.streakDays = 1;
            }
        }

        this.statistics.lastStudyDate = new Date().toISOString();
    }

    // 최근 7일 활동 계산
    private calculateRecentActivity() {
        const activity = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();

            const wordsStudied = Array.from(this.words.values()).filter(word => {
                if (!word.lastReviewed) return false;
                return new Date(word.lastReviewed).toDateString() === dateStr;
            }).length;

            const reviewsCompleted = Array.from(this.words.values()).filter(word => {
                if (!word.lastReviewed) return false;
                const reviewDate = new Date(word.lastReviewed);
                return reviewDate.toDateString() === dateStr;
            }).length;

            activity.push({
                date: date.toISOString().split('T')[0],
                wordsStudied,
                reviewsCompleted
            });
        }

        return activity;
    }

    // 단어장 폴더 경로 업데이트
    updateVocabularyFolderPath(newPath: string): void {
        this.vocabularyFolderPath = newPath;
        this.initializeVocabularyFolder();
    }
} 