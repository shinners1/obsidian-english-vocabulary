import { IVocabularyRepository } from '../../../core/ports/IVocabularyRepository';
import { IBookRepository } from '../../../core/ports/IBookRepository';
import { Statistics } from '../../../shared/lib/types';

export interface StatisticsViewDependencies {
    vocabularyRepository: IVocabularyRepository;
    bookRepository: IBookRepository;
}

export class StatisticsView {
    private dependencies: StatisticsViewDependencies;

    constructor(dependencies: StatisticsViewDependencies) {
        this.dependencies = dependencies;
    }

    async render(container: HTMLElement): Promise<void> {
        container.empty();
        container.addClass('statistics-view');

        const currentBook = await this.dependencies.bookRepository.getCurrentBook();
        const statistics = await this.dependencies.vocabularyRepository.getStatistics(currentBook?.id);

        this.createStatisticsHeader(container, currentBook?.name || '전체');
        this.createOverviewSection(container, statistics);
        this.createDifficultySection(container, statistics);
        this.createProgressSection(container, statistics);
        this.createRecentActivitySection(container, statistics);
    }

    private createStatisticsHeader(container: HTMLElement, bookName: string): void {
        const headerEl = container.createEl('div', { cls: 'statistics-header' });
        headerEl.createEl('h2', { 
            text: `${bookName} 통계`, 
            cls: 'statistics-title' 
        });
        
        const refreshBtn = headerEl.createEl('button', { 
            text: '새로고침', 
            cls: 'refresh-button' 
        });
        refreshBtn.addEventListener('click', () => {
            this.render(container);
        });
    }

    private createOverviewSection(container: HTMLElement, stats: Statistics): void {
        const overviewEl = container.createEl('div', { cls: 'statistics-overview' });
        overviewEl.createEl('h3', { text: '전체 현황', cls: 'section-title' });

        const overviewGrid = overviewEl.createEl('div', { cls: 'stats-grid' });
        
        this.createStatItem(overviewGrid, '총 단어 수', stats.totalWords.toString());
        this.createStatItem(overviewGrid, '총 복습 횟수', stats.totalReviews.toString());
        this.createStatItem(overviewGrid, '연속 학습 일수', `${stats.streakDays}일`);
        this.createStatItem(overviewGrid, '평균 난이도', this.formatAverageDifficulty(stats.averageDifficulty));
    }

    private createDifficultySection(container: HTMLElement, stats: Statistics): void {
        const difficultyEl = container.createEl('div', { cls: 'statistics-difficulty' });
        difficultyEl.createEl('h3', { text: '난이도별 분포', cls: 'section-title' });

        const difficultyGrid = difficultyEl.createEl('div', { cls: 'difficulty-grid' });
        
        const total = stats.totalWords;
        const difficulties = [
            { key: 'easy', label: '쉬움', count: stats.wordsByDifficulty.easy, color: '#4ade80' },
            { key: 'good', label: '보통', count: stats.wordsByDifficulty.good, color: '#60a5fa' },
            { key: 'hard', label: '어려움', count: stats.wordsByDifficulty.hard, color: '#f87171' }
        ];

        difficulties.forEach(difficulty => {
            const percentage = total > 0 ? Math.round((difficulty.count / total) * 100) : 0;
            const itemEl = difficultyGrid.createEl('div', { cls: 'difficulty-item' });
            
            const labelEl = itemEl.createEl('div', { cls: 'difficulty-label' });
            labelEl.createEl('span', { text: difficulty.label, cls: 'label-text' });
            labelEl.createEl('span', { text: `${difficulty.count}개 (${percentage}%)`, cls: 'label-count' });
            
            const barEl = itemEl.createEl('div', { cls: 'difficulty-bar' });
            const fillEl = barEl.createEl('div', { cls: 'difficulty-fill' });
            fillEl.style.width = `${percentage}%`;
            fillEl.style.backgroundColor = difficulty.color;
        });
    }

    private createProgressSection(container: HTMLElement, stats: Statistics): void {
        const progressEl = container.createEl('div', { cls: 'statistics-progress' });
        progressEl.createEl('h3', { text: '학습 진행도', cls: 'section-title' });

        // 전체 학습 진행도 계산 (임시 로직)
        const totalProgress = stats.totalWords > 0 
            ? Math.round((stats.totalReviews / (stats.totalWords * 3)) * 100) 
            : 0;
        const clampedProgress = Math.min(totalProgress, 100);

        const progressBarEl = progressEl.createEl('div', { cls: 'progress-bar-container' });
        progressBarEl.createEl('div', { text: `전체 진행도: ${clampedProgress}%`, cls: 'progress-label' });
        
        const progressBar = progressBarEl.createEl('div', { cls: 'progress-bar' });
        const progressFill = progressBar.createEl('div', { cls: 'progress-fill progress-bar-fill' });
        progressFill.style.width = `${clampedProgress}%`;
        
        // 진행도에 따른 색상 변경
        if (clampedProgress < 30) {
            progressFill.addClass('progress-low');
        } else if (clampedProgress < 70) {
            progressFill.addClass('progress-medium');
        } else {
            progressFill.addClass('progress-high');
        }
    }

    private createRecentActivitySection(container: HTMLElement, stats: Statistics): void {
        const activityEl = container.createEl('div', { cls: 'statistics-activity' });
        activityEl.createEl('h3', { text: '최근 활동', cls: 'section-title' });

        if (stats.recentActivity.length === 0) {
            activityEl.createEl('p', { 
                text: '최근 활동이 없습니다.', 
                cls: 'no-activity' 
            });
            return;
        }

        const activityList = activityEl.createEl('div', { cls: 'activity-list' });
        
        stats.recentActivity.slice(0, 7).forEach(activity => {
            const activityItem = activityList.createEl('div', { cls: 'activity-item' });
            
            const dateEl = activityItem.createEl('div', { cls: 'activity-date' });
            dateEl.textContent = new Date(activity.date).toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric'
            });
            
            const detailsEl = activityItem.createEl('div', { cls: 'activity-details' });
            detailsEl.createEl('span', { 
                text: `학습: ${activity.wordsStudied}개`, 
                cls: 'activity-stat' 
            });
            detailsEl.createEl('span', { 
                text: `복습: ${activity.reviewsCompleted}회`, 
                cls: 'activity-stat' 
            });
        });
    }

    private createStatItem(container: HTMLElement, label: string, value: string): void {
        const itemEl = container.createEl('div', { cls: 'stat-item' });
        itemEl.createEl('div', { text: label, cls: 'stat-label' });
        itemEl.createEl('div', { text: value, cls: 'stat-value' });
    }

    private formatAverageDifficulty(average: number): string {
        if (average < 1.5) return '쉬움';
        if (average < 2.5) return '보통';
        return '어려움';
    }
} 