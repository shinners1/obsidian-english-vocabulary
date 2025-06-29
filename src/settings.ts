import { App, PluginSettingTab, Setting, Notice, TFolder } from 'obsidian';
import EnglishVocabularyPlugin from './main';
import { LLMService } from './LLMService';
import { encryptApiKey, decryptApiKey, maskApiKey } from './utils';

export interface VocabularySettings {
    apiKey: string;
    defaultLanguage: string;
    showSimilarWords: boolean;
    showExamples: boolean;
    examplesCount: number;
    // 각 제공업체별 암호화된 API 키
    openaiApiKey: string;
    anthropicApiKey: string;
    googleApiKey: string;
    llmProvider: 'openai' | 'anthropic' | 'google';
    llmModel: string;
    enableAdvancedFeatures: boolean;
    // 복습 화면 높이 설정
    reviewModalHeight: number;
    // 단어장 저장 폴더 경로
    vocabularyFolderPath: string;
    // TTS 설정
    ttsEnabled: boolean;
    ttsVoice: string;
    ttsPlaybackSpeed: number;
    ttsAutoPlay: boolean;
}

export const DEFAULT_SETTINGS: VocabularySettings = {
    apiKey: '',
    defaultLanguage: 'ko',
    showSimilarWords: true,
    showExamples: true,
    examplesCount: 3,
    openaiApiKey: '',
    anthropicApiKey: '',
    googleApiKey: '',
    llmProvider: 'openai',
    llmModel: 'gemini-1.0-pro-latest',
    enableAdvancedFeatures: false,
    reviewModalHeight: 85,
    vocabularyFolderPath: 'Vocabulary',
    ttsEnabled: true,
    ttsVoice: 'en-US-AvaNeural',
    ttsPlaybackSpeed: 1.0,
    ttsAutoPlay: false
};

export class VocabularySettingTab extends PluginSettingTab {
    plugin: EnglishVocabularyPlugin;

    constructor(app: App, plugin: EnglishVocabularyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '영어 단어 학습 플러그인 설정' });

        this.createBasicSettings(containerEl);
        
        this.createLLMSettings(containerEl);
        
        this.createTTSSettings(containerEl);
        
        this.createAdvancedSettings(containerEl);
    }

    private createBasicSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '기본 설정' });

        new Setting(containerEl)
            .setName('기본 언어')
            .setDesc('단어 뜻을 표시할 언어를 선택하세요.')
            .addDropdown(dropdown => dropdown
                .addOption('ko', '한국어')
                .addOption('en', 'English')
                .addOption('ja', '日本語')
                .setValue(this.plugin.settings.defaultLanguage)
                .onChange(async (value) => {
                    this.plugin.settings.defaultLanguage = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('유사한 단어 표시')
            .setDesc('학습할 때 유사한 단어들을 함께 표시합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showSimilarWords)
                .onChange(async (value) => {
                    this.plugin.settings.showSimilarWords = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('예문 표시')
            .setDesc('학습할 때 예문들을 함께 표시합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showExamples)
                .onChange(async (value) => {
                    this.plugin.settings.showExamples = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('예문 개수')
            .setDesc('표시할 예문의 개수를 설정하세요.')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.examplesCount)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.examplesCount = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createLLMSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'LLM API 설정' });

        new Setting(containerEl)
            .setName('고급 기능 활성화')
            .setDesc('LLM API를 사용한 고급 기능을 활성화합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAdvancedFeatures)
                .onChange(async (value) => {
                    this.plugin.settings.enableAdvancedFeatures = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('LLM 제공업체')
            .setDesc('사용할 LLM API 제공업체를 선택하세요.')
            .addDropdown(dropdown => dropdown
                .addOption('openai', 'OpenAI (GPT)')
                .addOption('anthropic', 'Anthropic (Claude)')
                .addOption('google', 'Google (Gemini)')
                .setValue(this.plugin.settings.llmProvider)
                .onChange(async (value) => {
                    this.plugin.settings.llmProvider = value as 'openai' | 'anthropic' | 'google';
                    if (value === 'openai') {
                        this.plugin.settings.llmModel = 'gpt-4.1';
                    } else if (value === 'anthropic') {
                        this.plugin.settings.llmModel = 'claude-3-5-sonnet';
                    } else if (value === 'google') {
                        this.plugin.settings.llmModel = 'gemini-2.5-flash';
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }));

        this.createModelSelection(containerEl);

        // 각 제공업체별 API 키 설정
        this.createApiKeySettings(containerEl);

        new Setting(containerEl)
            .setName('API 연결 테스트')
            .setDesc('현재 선택된 제공업체의 API 키가 올바르게 설정되었는지 테스트합니다.')
            .addButton(button => button
                .setButtonText('테스트')
                .onClick(async () => {
                    button.setButtonText('테스트 중...');
                    button.setDisabled(true);
                    
                    try {
                        const llmService = new LLMService(this.plugin.settings);
                        const result = await llmService.testConnection();
                        
                        if (result.success) {
                            new Notice('✅ API 연결 성공!');
                        } else {
                            new Notice('❌ API 연결 실패: ' + result.error);
                        }
                    } catch (error) {
                        new Notice('❌ API 연결 실패: ' + error.message);
                    } finally {
                        button.setButtonText('테스트');
                        button.setDisabled(false);
                    }
                }));
    }

    private createModelSelection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('API 모델')
            .setDesc('사용할 LLM 모델을 선택하세요.')
            .addDropdown(dropdown => {
                const provider = this.plugin.settings.llmProvider;
                if (provider === 'openai') {
                    dropdown
                        .addOption('gpt-4.1', 'GPT-4.1')
                        .addOption('gpt-4o', 'GPT-4o')
                        .addOption('gpt-4o-mini', 'GPT-4o Mini')                        
                        .addOption('gpt-4.1-long', 'GPT-4.1 (Long Context)')
                        .addOption('gpt-4.5-preview', 'GPT-4.5 Preview')
                        .addOption('gpt-4.5-preview-2', 'GPT-4.5 Preview 2');
                } else if (provider === 'anthropic') {
                    dropdown
                        // Claude 3.5 모델들
                        .addOption('claude-3-5-sonnet', 'Claude 3.5 Sonnet')
                        .addOption('claude-3-5-haiku', 'Claude 3.5 Haiku')
                        .addOption('claude-3-5-opus', 'Claude 3.5 Opus')
                        // Claude 3.7 모델들
                        .addOption('claude-3-7-sonnet', 'Claude 3.7 Sonnet')
                        .addOption('claude-3-7-haiku', 'Claude 3.7 Haiku')
                        .addOption('claude-3-7-opus', 'Claude 3.7 Opus')
                        .addOption('claude-3-5-flash', 'Claude 3.5 Flash');
                } else if (provider === 'google') {
                    dropdown
                        .addOption('gemini-1.5-pro-latest', 'Gemini 1.5 Pro')
                        .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                        .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                        .addOption('gemini-1.5-flash-latest', 'Gemini 1.5 Flash');
                }
                return dropdown
                    .setValue(this.plugin.settings.llmModel)
                    .onChange(async (value) => {
                        this.plugin.settings.llmModel = value;
                        await this.plugin.saveSettings();
                    });
            });
    }

    private createApiKeySettings(containerEl: HTMLElement) {
        // OpenAI API 키
        new Setting(containerEl)
            .setName('OpenAI API 키')
            .setDesc('OpenAI API 키를 입력하세요. (sk-...로 시작)')
            .addText(text => {
                const currentKey = this.plugin.settings.openaiApiKey;
                const decryptedKey = decryptApiKey(currentKey);
                const maskedKey = maskApiKey(decryptedKey);
                
                return text
                    .setPlaceholder('sk-...')
                    .setValue(maskedKey)
                    .onChange(async (value) => {
                        // 사용자가 입력한 값이 마스킹된 값과 다르면 새로운 키로 간주
                        if (value !== maskedKey) {
                            const encryptedKey = encryptApiKey(value);
                            this.plugin.settings.openaiApiKey = encryptedKey;
                            await this.plugin.saveSettings();
                        }
                    });
            });

        // Anthropic API 키
        new Setting(containerEl)
            .setName('Anthropic API 키')
            .setDesc('Anthropic API 키를 입력하세요. (sk-ant-...로 시작)')
            .addText(text => {
                const currentKey = this.plugin.settings.anthropicApiKey;
                const decryptedKey = decryptApiKey(currentKey);
                const maskedKey = maskApiKey(decryptedKey);
                
                return text
                    .setPlaceholder('sk-ant-...')
                    .setValue(maskedKey)
                    .onChange(async (value) => {
                        if (value !== maskedKey) {
                            const encryptedKey = encryptApiKey(value);
                            this.plugin.settings.anthropicApiKey = encryptedKey;
                            await this.plugin.saveSettings();
                        }
                    });
            });

        // Google API 키
        new Setting(containerEl)
            .setName('Google API 키')
            .setDesc('Google API 키를 입력하세요.')
            .addText(text => {
                const currentKey = this.plugin.settings.googleApiKey;
                const decryptedKey = decryptApiKey(currentKey);
                const maskedKey = maskApiKey(decryptedKey);
                
                return text
                    .setPlaceholder('AIza...')
                    .setValue(maskedKey)
                    .onChange(async (value) => {
                        if (value !== maskedKey) {
                            const encryptedKey = encryptApiKey(value);
                            this.plugin.settings.googleApiKey = encryptedKey;
                            await this.plugin.saveSettings();
                        }
                    });
            });
    }

    private createAdvancedSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '고급 설정' });

        // 폴더 목록 가져오기
        const folders = this.app.vault.getAllLoadedFiles()
            .filter(f => f instanceof TFolder) as TFolder[];

        new Setting(containerEl)
            .setName('단어장 저장 폴더')
            .setDesc('단어장 파일들이 저장될 폴더를 선택하세요. (기본값: Vocabulary)')
            .addDropdown(dropdown => {
                folders.forEach(folder => {
                    dropdown.addOption(folder.path, folder.path);
                });
                dropdown.setValue(this.plugin.settings.vocabularyFolderPath);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.vocabularyFolderPath = value;
                    await this.plugin.saveSettings();
                    if (this.plugin.databaseManager) {
                        this.plugin.databaseManager.updateVocabularyFolderPath(value);
                    }
                });
                return dropdown;
            });

        new Setting(containerEl)
            .setName('복습 화면 높이')
            .setDesc('복습 모달의 높이를 화면 높이의 백분율로 설정하세요. (기본값: 85%)')
            .addSlider(slider => slider
                .setLimits(50, 95, 5)
                .setValue(this.plugin.settings.reviewModalHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.reviewModalHeight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('일일 학습 목표')
            .setDesc('하루에 학습할 단어의 목표 개수를 설정하세요.')
            .addSlider(slider => slider
                .setLimits(5, 50, 5)
                .setValue(this.plugin.databaseManager?.getDataForSave()?.settings?.dailyGoal || 10)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    await this.plugin.databaseManager?.updateSettings({ dailyGoal: value });
                }));

        new Setting(containerEl)
            .setName('복습 간격 (일)')
            .setDesc('단어를 다시 복습할 간격을 설정하세요.')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.databaseManager?.getDataForSave()?.settings?.reviewInterval || 1)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    await this.plugin.databaseManager?.updateSettings({ reviewInterval: value });
                }));
    }

    private createTTSSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'TTS (음성 읽기) 설정' });

        new Setting(containerEl)
            .setName('TTS 활성화')
            .setDesc('단어와 예문을 음성으로 읽어주는 기능을 활성화합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ttsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.ttsEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('음성 선택')
            .setDesc('사용할 음성을 선택하세요.')
            .addDropdown(dropdown => dropdown
                .addOption('en-US-AvaNeural', 'Ava (미국 영어)')
                .addOption('en-US-JennyNeural', 'Jenny (미국 영어)')
                .addOption('en-GB-SoniaNeural', 'Sonia (영국 영어)')
                .addOption('en-GB-RyanNeural', 'Ryan (영국 영어)')
                .addOption('en-AU-NatashaNeural', 'Natasha (호주 영어)')
                .setValue(this.plugin.settings.ttsVoice)
                .onChange(async (value) => {
                    this.plugin.settings.ttsVoice = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('재생 속도')
            .setDesc('음성 재생 속도를 조절하세요. (0.5 = 느림, 1.0 = 보통, 2.0 = 빠름)')
            .addSlider(slider => slider
                .setLimits(0.5, 2.0, 0.1)
                .setValue(this.plugin.settings.ttsPlaybackSpeed)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.ttsPlaybackSpeed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('자동 재생')
            .setDesc('단어 카드가 표시될 때 자동으로 단어를 읽어줍니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ttsAutoPlay)
                .onChange(async (value) => {
                    this.plugin.settings.ttsAutoPlay = value;
                    await this.plugin.saveSettings();
                }));
    }
} 