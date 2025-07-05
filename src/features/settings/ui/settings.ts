import { App, PluginSettingTab, Setting, Notice, TFolder, requestUrl } from 'obsidian';
import EnglishVocabularyPlugin from '../../../main';
import { LLMService } from '../../../infrastructure/llm/LLMService';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../../../utils';

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
    ttsProvider: 'chatterbox' | 'google-cloud';
    ttsVoice: string;
    ttsPlaybackSpeed: number;
    ttsAutoPlay: boolean;
    // Chatterbox TTS 전용 설정
    chatterboxApiUrl: string;
    chatterboxExaggeration: number;
    chatterboxCfgWeight: number;
    chatterboxTemperature: number;
    // Google Cloud TTS 전용 설정
    googleCloudTTSApiKey: string;
    googleCloudTTSLanguageCode: string;
    googleCloudTTSSpeakingRate: number;
    googleCloudTTSPitch: number;
    // TTS 캐시 설정
    ttsCacheEnabled: boolean;
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
    ttsProvider: 'chatterbox',
    ttsVoice: 'alloy',
    ttsPlaybackSpeed: 1.0,
    ttsAutoPlay: false,
    // Chatterbox TTS 기본값
    chatterboxApiUrl: 'http://localhost:4123', // 경고: HTTP는 보안에 취약합니다. 가능하면 HTTPS를 사용하세요.
    chatterboxExaggeration: 0.7,
    chatterboxCfgWeight: 0.4,
    chatterboxTemperature: 0.9,
    // Google Cloud TTS 기본값
    googleCloudTTSApiKey: '',
    googleCloudTTSLanguageCode: 'en-US',
    googleCloudTTSSpeakingRate: 1.0,
    googleCloudTTSPitch: 0.0,
    // TTS 캐시 설정
    ttsCacheEnabled: true
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
            .filter(f => f instanceof TFolder);

        new Setting(containerEl)
            .setName('단어장 저장 폴더')
            .setDesc('단어장 파일들이 저장될 폴더를 선택하세요. (기본값: Vocabulary)')
            .addDropdown(dropdown => {
                folders.forEach(folder => {
                    if (folder instanceof TFolder) {
                        dropdown.addOption(folder.path, folder.path);
                    }
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

        const ttsToggleSetting = new Setting(containerEl)
            .setName('TTS 활성화')
            .setDesc('단어와 예문을 음성으로 읽어주는 기능을 활성화합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ttsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.ttsEnabled = value;
                    await this.plugin.saveSettings();
                    // TTS 설정 UI 업데이트
                    this.updateTTSSettingsVisibility();
                }));

        // TTS 제공자 선택
        new Setting(containerEl)
            .setName('TTS 제공자')
            .setDesc('사용할 TTS 서비스를 선택하세요.')
            .setClass('tts-provider-setting')
            .addDropdown(dropdown => dropdown
                .addOption('chatterbox', 'Chatterbox TTS (로컬)')
                .addOption('google-cloud', 'Google Cloud Text-to-Speech')
                .setValue(this.plugin.settings.ttsProvider)
                .onChange(async (value) => {
                    this.plugin.settings.ttsProvider = value as 'chatterbox' | 'google-cloud';
                    await this.plugin.saveSettings();
                    this.updateTTSProviderSettings();
                }));

        // Chatterbox TTS 설정
        this.createChatterboxTTSSettings(containerEl);

        // Google Cloud TTS 설정
        this.createGoogleCloudTTSSettings(containerEl);

        // 자동 재생 설정 (공통)
        const autoPlaySetting = new Setting(containerEl)
            .setName('자동 재생')
            .setDesc('단어 카드가 표시될 때 자동으로 단어를 읽어줍니다.')
            .setClass('tts-autoplay-setting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ttsAutoPlay)
                .onChange(async (value) => {
                    this.plugin.settings.ttsAutoPlay = value;
                    await this.plugin.saveSettings();
                }));

        // TTS 캐시 관리 섹션
        this.createTTSCacheSettings(containerEl);
        
        // 초기 상태 설정
        this.updateTTSSettingsVisibility();
        // 제공자별 설정 초기화
        this.updateTTSProviderSettings();
    }

    private populateChatterboxVoiceDropdown(dropdown: any): void {
        // Chatterbox TTS 지원 음성들 (OpenAI 호환)
        const chatterboxVoices = [
            { value: 'alloy', name: 'Alloy (중성적)' },
            { value: 'echo', name: 'Echo (남성)' },
            { value: 'fable', name: 'Fable (영국식)' },
            { value: 'onyx', name: 'Onyx (깊은 남성)' },
            { value: 'nova', name: 'Nova (여성)' },
            { value: 'shimmer', name: 'Shimmer (부드러운 여성)' },
            { value: 'custom', name: 'Custom (사용자 정의)' }
        ];

        // Chatterbox 음성들 추가
        chatterboxVoices.forEach(option => {
            dropdown.addOption(option.value, option.name);
        });

        // 실제 브라우저에서 사용 가능한 영어 음성들 추가
        try {
            const voices = speechSynthesis.getVoices();
            const englishVoices = voices.filter(voice => 
                voice.lang.startsWith('en-') && 
                !voice.lang.includes('ko') &&
                !chatterboxVoices.some(opt => opt.value === voice.name)
            );

            if (englishVoices.length > 0) {
                // 구분선 추가
                dropdown.addOption('---', '--- 시스템 음성 ---');
                
                englishVoices.forEach(voice => {
                    const displayName = `${voice.name} (${voice.lang})`;
                    dropdown.addOption(voice.name, displayName);
                });
            }
        } catch (error) {
            console.warn('음성 목록을 가져오는 중 오류:', error);
        }
    }

    private updateTTSSettingsVisibility(): void {
        const isEnabled = this.plugin.settings.ttsEnabled;
        
        // 모든 TTS 관련 설정들
        const allTtsSettings = this.containerEl.querySelectorAll(
            '.tts-provider-setting, .chatterbox-api-url-setting, .chatterbox-voice-setting, .chatterbox-exaggeration-setting, .chatterbox-cfg-setting, .chatterbox-temperature-setting, .google-cloud-tts-guide, .google-cloud-api-key-setting, .google-cloud-language-setting, .google-cloud-voice-setting, .google-cloud-speaking-rate-setting, .google-cloud-pitch-setting, .tts-autoplay-setting, .tts-cache-header, .tts-cache-enabled-setting, .tts-cache-info-setting, .tts-cache-clear-setting'
        );
        
        allTtsSettings.forEach(setting => {
            const element = setting as HTMLElement;
            if (isEnabled) {
                element.removeClass('settings-disabled');
                element.addClass('settings-enabled');
                const buttons = element.querySelectorAll('button');
                const dropdowns = element.querySelectorAll('select');
                const sliders = element.querySelectorAll('input[type="range"]');
                const toggles = element.querySelectorAll('input[type="checkbox"]');
                const inputs = element.querySelectorAll('input[type="text"]');
                
                buttons.forEach(btn => (btn as HTMLButtonElement).disabled = false);
                dropdowns.forEach(dd => (dd as HTMLSelectElement).disabled = false);
                sliders.forEach(slider => (slider as HTMLInputElement).disabled = false);
                toggles.forEach(toggle => (toggle as HTMLInputElement).disabled = false);
                inputs.forEach(input => (input as HTMLInputElement).disabled = false);
            } else {
                element.removeClass('settings-enabled');
                element.addClass('settings-disabled');
                const buttons = element.querySelectorAll('button');
                const dropdowns = element.querySelectorAll('select');
                const sliders = element.querySelectorAll('input[type="range"]');
                const toggles = element.querySelectorAll('input[type="checkbox"]');
                const inputs = element.querySelectorAll('input[type="text"]');
                
                buttons.forEach(btn => (btn as HTMLButtonElement).disabled = true);
                dropdowns.forEach(dd => (dd as HTMLSelectElement).disabled = true);
                sliders.forEach(slider => (slider as HTMLInputElement).disabled = true);
                toggles.forEach(toggle => (toggle as HTMLInputElement).disabled = true);
                inputs.forEach(input => (input as HTMLInputElement).disabled = true);
            }
        });
        
        // TTS가 활성화된 경우 제공자별 설정 업데이트
        if (isEnabled) {
            this.updateTTSProviderSettings();
        }
    }


    private async testChatterboxConnection(): Promise<void> {
        try {
            const response = await fetch(`${this.plugin.settings.chatterboxApiUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: 'Connection test',
                    voice: 'alloy'
                })
            });

            if (response.ok) {
                new Notice('✅ Chatterbox TTS 서버 연결 성공!');
            } else {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
        } catch (error) {
            console.error('Chatterbox TTS 연결 테스트 실패:', error);
            new Notice('❌ Chatterbox TTS 서버 연결 실패. 서버가 실행 중인지 확인해주세요.');
            throw error;
        }
    }

    private createChatterboxTTSSettings(containerEl: HTMLElement) {
        // Chatterbox API URL 설정
        new Setting(containerEl)
            .setName('Chatterbox TTS API URL')
            .setDesc('Chatterbox TTS 서버의 URL을 입력하세요. (기본값: http://localhost:4123)')
            .setClass('chatterbox-api-url-setting')
            .addText(text => text
                .setPlaceholder('http://localhost:4123')
                .setValue(this.plugin.settings.chatterboxApiUrl)
                .onChange(async (value) => {
                    this.plugin.settings.chatterboxApiUrl = value || 'http://localhost:4123'; // 기본값: HTTP (보안 위험)
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText('연결 테스트')
                .setTooltip('Chatterbox TTS 서버 연결을 테스트합니다')
                .onClick(async () => {
                    button.setButtonText('테스트 중...');
                    button.setDisabled(true);
                    
                    try {
                        await this.testChatterboxConnection();
                    } finally {
                        button.setButtonText('연결 테스트');
                        button.setDisabled(false);
                    }
                }));

        // Chatterbox 음성 선택
        new Setting(containerEl)
            .setName('음성 선택')
            .setDesc('Chatterbox TTS에서 사용할 음성을 선택하세요.')
            .setClass('chatterbox-voice-setting')
            .addDropdown(dropdown => {
                this.populateChatterboxVoiceDropdown(dropdown);
                return dropdown
                    .setValue(this.plugin.settings.ttsVoice)
                    .onChange(async (value) => {
                        this.plugin.settings.ttsVoice = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('미리듣기')
                .setTooltip('선택한 음성으로 샘플 텍스트를 재생합니다')
                .onClick(async () => {
                    button.setButtonText('재생 중...');
                    button.setDisabled(true);
                    
                    try {
                        await this.playChatterboxVoicePreview();
                    } catch (error) {
                        console.error('음성 미리듣기 오류:', error);
                        new Notice('음성 재생 중 오류가 발생했습니다.');
                    } finally {
                        button.setButtonText('미리듣기');
                        button.setDisabled(false);
                    }
                }));

        // Chatterbox TTS 전용 설정들
        new Setting(containerEl)
            .setName('감정 표현 강도 (Exaggeration)')
            .setDesc('음성의 감정 표현 강도를 조절합니다. (0.25 = 약함, 2.0 = 강함)')
            .setClass('chatterbox-exaggeration-setting')
            .addSlider(slider => slider
                .setLimits(0.25, 2.0, 0.05)
                .setValue(this.plugin.settings.chatterboxExaggeration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.chatterboxExaggeration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('CFG 가중치 (CFG Weight)')
            .setDesc('음성 생성의 가이던스 강도를 조절합니다. (0.0 = 약함, 1.0 = 강함)')
            .setClass('chatterbox-cfg-setting')
            .addSlider(slider => slider
                .setLimits(0.0, 1.0, 0.05)
                .setValue(this.plugin.settings.chatterboxCfgWeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.chatterboxCfgWeight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('온도 (Temperature)')
            .setDesc('음성 생성의 창의성을 조절합니다. (0.05 = 일관성, 5.0 = 창의성)')
            .setClass('chatterbox-temperature-setting')
            .addSlider(slider => slider
                .setLimits(0.05, 5.0, 0.05)
                .setValue(this.plugin.settings.chatterboxTemperature)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.chatterboxTemperature = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createGoogleCloudTTSSettings(containerEl: HTMLElement) {
        // Google Cloud TTS 사용 가이드
        const guideEl = containerEl.createEl('div', { 
            cls: 'google-cloud-tts-guide google-cloud-api-key-setting',
            attr: { style: 'margin-bottom: 15px; padding: 10px; background-color: var(--background-secondary); border-radius: 5px; border-left: 3px solid var(--interactive-accent);' }
        });
        
        guideEl.createEl('h4', { text: '🔧 Google Cloud TTS 설정 가이드', attr: { style: 'margin: 0 0 10px 0; color: var(--interactive-accent);' } });
        
        const stepsList = guideEl.createEl('ol', { attr: { style: 'margin: 0; padding-left: 20px; line-height: 1.6;' } });
        
        const step1 = stepsList.createEl('li');
        step1.createEl('strong', { text: 'Google Cloud Console 접속:' });
        step1.appendText(' ');
        const step1Link = step1.createEl('a', { 
            text: 'console.cloud.google.com',
            href: 'https://console.cloud.google.com',
            attr: { style: 'color: var(--interactive-accent);' }
        });
        step1Link.addEventListener('click', () => {
            window.open('https://console.cloud.google.com', '_blank');
        });
        
        const step2 = stepsList.createEl('li');
        step2.createEl('strong', { text: '프로젝트 선택/생성:' });
        step2.appendText(' 기존 프로젝트를 선택하거나 새 프로젝트를 생성합니다.');
        
        const step3 = stepsList.createEl('li');
        step3.createEl('strong', { text: 'Text-to-Speech API 활성화:' });
        step3.appendText(' ');
        const step3Link = step3.createEl('a', {
            text: 'API 라이브러리에서 활성화',
            href: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com',
            attr: { style: 'color: var(--interactive-accent);' }
        });
        step3Link.addEventListener('click', () => {
            window.open('https://console.cloud.google.com/apis/library/texttospeech.googleapis.com', '_blank');
        });
        
        const step4 = stepsList.createEl('li');
        step4.createEl('strong', { text: 'API 키 생성:' });
        step4.appendText(' 사용자 인증 정보 > API 키 > 새 API 키 생성');
        
        const step5 = stepsList.createEl('li');
        step5.createEl('strong', { text: 'API 키 제한 설정 (권장):' });
        step5.appendText(' 키 제한 > API 제한 > Cloud Text-to-Speech API 선택');
        
        const warningEl = guideEl.createEl('div', { 
            attr: { style: 'margin-top: 10px; padding: 8px; background-color: var(--background-modifier-error-rgb); border-radius: 3px; font-size: 0.9em;' }
        });
        warningEl.appendText('⚠️ ');
        warningEl.createEl('strong', { text: '중요:' });
        warningEl.appendText(' Text-to-Speech API가 활성화되지 않은 경우 "API_KEY_SERVICE_BLOCKED" 오류가 발생합니다.');

        // Google Cloud API 키 설정
        new Setting(containerEl)
            .setName('Google Cloud TTS API 키')
            .setDesc('Google Cloud Text-to-Speech API 키를 입력하세요.')
            .setClass('google-cloud-api-key-setting')
            .addText(text => {
                const currentKey = this.plugin.settings.googleCloudTTSApiKey;
                const decryptedKey = decryptApiKey(currentKey);
                const maskedKey = maskApiKey(decryptedKey);
                
                return text
                    .setPlaceholder('AIza...')
                    .setValue(maskedKey)
                    .onChange(async (value) => {
                        if (value !== maskedKey) {
                            const encryptedKey = encryptApiKey(value);
                            this.plugin.settings.googleCloudTTSApiKey = encryptedKey;
                            await this.plugin.saveSettings();
                        }
                    });
            })
            .addButton(button => button
                .setButtonText('연결 테스트')
                .setTooltip('Google Cloud TTS API 연결을 테스트합니다')
                .onClick(async () => {
                    button.setButtonText('테스트 중...');
                    button.setDisabled(true);
                    
                    try {
                        await this.testGoogleCloudConnection();
                    } finally {
                        button.setButtonText('연결 테스트');
                        button.setDisabled(false);
                    }
                }));

        // Google Cloud 언어 설정
        new Setting(containerEl)
            .setName('언어 코드')
            .setDesc('사용할 언어 코드를 선택하세요.')
            .setClass('google-cloud-language-setting')
            .addDropdown(dropdown => dropdown
                .addOption('en-US', 'English (US)')
                .addOption('en-GB', 'English (UK)')
                .addOption('en-AU', 'English (AU)')
                .addOption('en-IN', 'English (India)')
                .setValue(this.plugin.settings.googleCloudTTSLanguageCode)
                .onChange(async (value) => {
                    this.plugin.settings.googleCloudTTSLanguageCode = value;
                    await this.plugin.saveSettings();
                    this.updateGoogleCloudVoices();
                }));

        // Google Cloud 음성 선택
        new Setting(containerEl)
            .setName('음성 선택')
            .setDesc('Google Cloud TTS에서 사용할 음성을 선택하세요.')
            .setClass('google-cloud-voice-setting')
            .addDropdown(dropdown => {
                this.populateGoogleCloudVoiceDropdown(dropdown);
                return dropdown
                    .setValue(this.plugin.settings.ttsVoice)
                    .onChange(async (value) => {
                        this.plugin.settings.ttsVoice = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('미리듣기')
                .setTooltip('선택한 음성으로 샘플 텍스트를 재생합니다')
                .onClick(async () => {
                    button.setButtonText('재생 중...');
                    button.setDisabled(true);
                    
                    try {
                        await this.playGoogleCloudVoicePreview();
                    } catch (error) {
                        console.error('음성 미리듣기 오류:', error);
                        new Notice('음성 재생 중 오류가 발생했습니다.');
                    } finally {
                        button.setButtonText('미리듣기');
                        button.setDisabled(false);
                    }
                }));

        // Google Cloud TTS 전용 설정들
        new Setting(containerEl)
            .setName('말하기 속도 (Speaking Rate)')
            .setDesc('음성의 말하기 속도를 조절합니다. (0.25 = 느림, 4.0 = 빠름)')
            .setClass('google-cloud-speaking-rate-setting')
            .addSlider(slider => slider
                .setLimits(0.25, 4.0, 0.25)
                .setValue(this.plugin.settings.googleCloudTTSSpeakingRate)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.googleCloudTTSSpeakingRate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('음성 높낮이 (Pitch)')
            .setDesc('음성의 높낮이를 조절합니다. (-20.0 = 낮음, 20.0 = 높음)')
            .setClass('google-cloud-pitch-setting')
            .addSlider(slider => slider
                .setLimits(-20.0, 20.0, 1.0)
                .setValue(this.plugin.settings.googleCloudTTSPitch)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.googleCloudTTSPitch = value;
                    await this.plugin.saveSettings();
                }));
    }

    private populateGoogleCloudVoiceDropdown(dropdown: any): void {
        const languageCode = this.plugin.settings.googleCloudTTSLanguageCode;
        
        if (languageCode === 'en-US') {
            dropdown
                .addOption('en-US-Journey-D', 'Journey-D (Male)')
                .addOption('en-US-Journey-F', 'Journey-F (Female)')
                .addOption('en-US-Journey-O', 'Journey-O (Male)')
                .addOption('en-US-Neural2-A', 'Neural2-A (Male)')
                .addOption('en-US-Neural2-C', 'Neural2-C (Female)')
                .addOption('en-US-Neural2-D', 'Neural2-D (Male)')
                .addOption('en-US-Neural2-E', 'Neural2-E (Female)')
                .addOption('en-US-Neural2-F', 'Neural2-F (Female)')
                .addOption('en-US-Neural2-G', 'Neural2-G (Female)')
                .addOption('en-US-Neural2-H', 'Neural2-H (Female)')
                .addOption('en-US-Neural2-I', 'Neural2-I (Male)')
                .addOption('en-US-Neural2-J', 'Neural2-J (Male)');
        } else if (languageCode === 'en-GB') {
            dropdown
                .addOption('en-GB-Neural2-A', 'Neural2-A (Female)')
                .addOption('en-GB-Neural2-B', 'Neural2-B (Male)')
                .addOption('en-GB-Neural2-C', 'Neural2-C (Female)')
                .addOption('en-GB-Neural2-D', 'Neural2-D (Male)')
                .addOption('en-GB-Neural2-F', 'Neural2-F (Female)');
        } else if (languageCode === 'en-AU') {
            dropdown
                .addOption('en-AU-Neural2-A', 'Neural2-A (Female)')
                .addOption('en-AU-Neural2-B', 'Neural2-B (Male)')
                .addOption('en-AU-Neural2-C', 'Neural2-C (Female)')
                .addOption('en-AU-Neural2-D', 'Neural2-D (Male)');
        } else {
            dropdown.addOption('en-US-Journey-F', 'Journey-F (Female)');
        }
    }

    private updateGoogleCloudVoices(): void {
        const voiceDropdown = this.containerEl.querySelector('.google-cloud-voice-setting select') as HTMLSelectElement;
        if (voiceDropdown) {
            voiceDropdown.empty();
            const dropdown = { addOption: (value: string, text: string) => {
                const option = document.createElement('option');
                option.value = value;
                option.text = text;
                voiceDropdown.appendChild(option);
            }};
            this.populateGoogleCloudVoiceDropdown(dropdown);
            
            // 기본 음성 설정
            const languageCode = this.plugin.settings.googleCloudTTSLanguageCode;
            let defaultVoice = 'en-US-Journey-F';
            if (languageCode === 'en-GB') defaultVoice = 'en-GB-Neural2-A';
            else if (languageCode === 'en-AU') defaultVoice = 'en-AU-Neural2-A';
            
            voiceDropdown.value = defaultVoice;
            this.plugin.settings.ttsVoice = defaultVoice;
            this.plugin.saveSettings();
        }
    }

    private updateTTSProviderSettings(): void {
        const provider = this.plugin.settings.ttsProvider;
        
        const chatterboxSettings = this.containerEl.querySelectorAll('.chatterbox-api-url-setting, .chatterbox-voice-setting, .chatterbox-exaggeration-setting, .chatterbox-cfg-setting, .chatterbox-temperature-setting');
        const googleCloudSettings = this.containerEl.querySelectorAll('.google-cloud-tts-guide, .google-cloud-api-key-setting, .google-cloud-language-setting, .google-cloud-voice-setting, .google-cloud-speaking-rate-setting, .google-cloud-pitch-setting');
        
        // 모든 설정 숨김
        chatterboxSettings.forEach(setting => {
            (setting as HTMLElement).style.display = 'none';
        });
        googleCloudSettings.forEach(setting => {
            (setting as HTMLElement).style.display = 'none';
        });
        
        // 선택된 제공자의 설정만 표시
        if (provider === 'chatterbox') {
            chatterboxSettings.forEach(setting => {
                (setting as HTMLElement).style.display = '';
            });
        } else if (provider === 'google-cloud') {
            googleCloudSettings.forEach(setting => {
                (setting as HTMLElement).style.display = '';
            });
        }
    }

    private async playChatterboxVoicePreview(): Promise<void> {
        try {
            const sampleTexts = [
                'Hello, this is a sample voice preview.',
                'Welcome to English vocabulary learning.',
                'This voice will help you learn pronunciation.',
                'Beautiful words make beautiful sentences.'
            ];
            
            const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];

            const response = await fetch(`${this.plugin.settings.chatterboxApiUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: randomText,
                    voice: this.plugin.settings.ttsVoice,
                    exaggeration: this.plugin.settings.chatterboxExaggeration,
                    cfg_weight: this.plugin.settings.chatterboxCfgWeight,
                    temperature: this.plugin.settings.chatterboxTemperature
                })
            });

            if (!response.ok) {
                throw new Error(`Chatterbox TTS API 오류: ${response.status} ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            
            return new Promise((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    new Notice('음성 미리듣기 완료!');
                    resolve();
                };
                
                audio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('오디오 재생 중 오류가 발생했습니다.'));
                };
                
                audio.play().catch(reject);
            });

        } catch (error) {
            console.error('Chatterbox TTS 미리듣기 오류:', error);
            new Notice('음성 미리듣기에 실패했습니다. Chatterbox TTS 서버가 실행 중인지 확인해주세요.');
            throw error;
        }
    }

    private async playGoogleCloudVoicePreview(): Promise<void> {
        try {
            const sampleTexts = [
                'Hello, this is a sample voice preview.',
                'Welcome to English vocabulary learning.',
                'This voice will help you learn pronunciation.',
                'Beautiful words make beautiful sentences.'
            ];
            
            const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
            const apiKey = decryptApiKey(this.plugin.settings.googleCloudTTSApiKey);

            if (!apiKey) {
                throw new Error('Google Cloud TTS API 키가 설정되지 않았습니다.');
            }

            const requestBody = {
                input: { text: randomText },
                voice: {
                    languageCode: this.plugin.settings.googleCloudTTSLanguageCode,
                    name: this.plugin.settings.ttsVoice
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: this.plugin.settings.googleCloudTTSSpeakingRate,
                    pitch: this.plugin.settings.googleCloudTTSPitch
                }
            };

            const response = await requestUrl({
                url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (response.status >= 400) {
                const errorData = JSON.parse(response.text || '{}');
                const detailedError = this.getDetailedGoogleCloudError(response.status, errorData);
                throw new Error(detailedError);
            }

            const data = JSON.parse(response.text);
            const audioBlob = this.base64ToBlob(data.audioContent, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            
            return new Promise((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    new Notice('음성 미리듣기 완료!');
                    resolve();
                };
                
                audio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('오디오 재생 중 오류가 발생했습니다.'));
                };
                
                audio.play().catch(reject);
            });

        } catch (error) {
            console.error('Google Cloud TTS 미리듣기 오류:', error);
            if (error.message.includes('API가 활성화되지 않았습니다')) {
                new Notice(`❌ ${error.message}`);
            } else if (error.message.includes('API 키')) {
                new Notice(`❌ ${error.message}`);
            } else {
                new Notice('❌ 음성 미리듣기에 실패했습니다. API 키와 인터넷 연결을 확인해주세요.');
            }
            throw error;
        }
    }

    private base64ToBlob(base64: string, mimeType: string): Blob {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    private async testGoogleCloudConnection(): Promise<void> {
        try {
            const apiKey = decryptApiKey(this.plugin.settings.googleCloudTTSApiKey);
            
            if (!apiKey) {
                new Notice('❌ Google Cloud TTS API 키를 먼저 입력해주세요.');
                return;
            }

            const response = await requestUrl({
                url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text: 'Connection test' },
                    voice: {
                        languageCode: 'en-US',
                        name: 'en-US-Journey-F'
                    },
                    audioConfig: {
                        audioEncoding: 'MP3'
                    }
                })
            });

            if (response.status < 400) {
                new Notice('✅ Google Cloud TTS API 연결 성공!');
            } else {
                const errorData = JSON.parse(response.text || '{}');
                const detailedError = this.getDetailedGoogleCloudError(response.status, errorData);
                new Notice(`❌ ${detailedError}`);
            }
        } catch (error) {
            console.error('Google Cloud TTS 연결 테스트 실패:', error);
            if (error.message.includes('네트워크') || error.message.includes('fetch')) {
                new Notice('❌ 인터넷 연결을 확인해주세요.');
            } else {
                new Notice(`❌ ${error.message}`);
            }
        }
    }

    private getDetailedGoogleCloudError(status: number, errorData: any): string {
        if (errorData?.error) {
            const error = errorData.error;
            
            // API가 차단된 경우 (403 PERMISSION_DENIED with API_KEY_SERVICE_BLOCKED)
            if (status === 403 && error.details?.some((detail: any) => 
                detail.reason === 'API_KEY_SERVICE_BLOCKED' || 
                detail['@type']?.includes('ErrorInfo') && detail.reason === 'API_KEY_SERVICE_BLOCKED'
            )) {
                return 'Text-to-Speech API가 활성화되지 않았습니다. 위의 가이드를 참고하여 API를 활성화해주세요.';
            }
            
            // API 키 관련 오류들
            if (status === 403) {
                if (error.message?.includes('API key not valid') || error.code === 'INVALID_ARGUMENT') {
                    return 'API 키가 올바르지 않습니다. 키를 다시 확인해주세요.';
                }
                if (error.message?.includes('quota') || error.message?.includes('QUOTA_EXCEEDED')) {
                    return 'API 할당량이 초과되었습니다. Google Cloud Console에서 할당량을 확인해주세요.';
                }
                return 'API 접근이 거부되었습니다. API 키 권한을 확인해주세요.';
            }
            
            // 인증 오류 (401)
            if (status === 401) {
                return 'API 키 인증에 실패했습니다. API 키가 올바른지 확인해주세요.';
            }
            
            // 요청 오류 (400)
            if (status === 400) {
                return 'API 요청이 잘못되었습니다. 음성 설정을 확인해주세요.';
            }
            
            // 서비스 사용 불가 (503)
            if (status === 503) {
                return 'Google Cloud TTS 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
            }
            
            return `API 오류 (${status}): ${error.message || '알 수 없는 오류'}`;
        }
        
        return `API 오류: ${status} 상태 코드`;
    }

    private createTTSCacheSettings(containerEl: HTMLElement) {
        // TTS 캐시 섹션 헤더
        const cacheHeaderEl = containerEl.createEl('div', { 
            cls: 'tts-cache-header',
            attr: { style: 'margin-top: 20px; padding: 10px; background-color: var(--background-secondary); border-radius: 5px; border-left: 3px solid var(--interactive-accent);' }
        });
        
        cacheHeaderEl.createEl('h4', { text: '🗂️ TTS 캐시 관리', attr: { style: 'margin: 0 0 5px 0; color: var(--interactive-accent);' } });
        cacheHeaderEl.createEl('p', { text: '음성 파일을 로컬에 캐시하여 API 비용을 절약하고 응답 속도를 향상시킵니다. 아래에서 현재 캐시 폴더의 용량과 파일 수를 확인할 수 있습니다.', attr: { style: 'margin: 0; font-size: 0.9em; opacity: 0.8;' } });

        // 캐시 활성화 설정
        new Setting(containerEl)
            .setName('TTS 캐시 활성화')
            .setDesc('TTS 음성 파일을 로컬에 캐시하여 재사용합니다.')
            .setClass('tts-cache-enabled-setting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ttsCacheEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.ttsCacheEnabled = value;
                    await this.plugin.saveSettings();
                }));

        // 캐시 정보 표시
        const cacheInfoSetting = new Setting(containerEl)
            .setName('📊 캐시 현황')
            .setDesc('캐시 정보를 불러오는 중...')
            .setClass('tts-cache-info-setting');

        this.updateCacheInfo(cacheInfoSetting);

        // 캐시 삭제 버튼
        new Setting(containerEl)
            .setName('캐시 관리')
            .setDesc('저장된 모든 TTS 캐시 파일을 삭제합니다.')
            .setClass('tts-cache-clear-setting')
            .addButton(button => button
                .setButtonText('캐시 삭제')
                .setTooltip('모든 TTS 캐시 파일을 삭제합니다')
                .onClick(async () => {
                    button.setButtonText('삭제 중...');
                    button.setDisabled(true);
                    
                    try {
                        const success = await this.clearTTSCache();
                        if (success) {
                            new Notice('✅ TTS 캐시가 성공적으로 삭제되었습니다.');
                            // 캐시 정보 업데이트
                            this.updateCacheInfo(cacheInfoSetting);
                        } else {
                            new Notice('❌ TTS 캐시 삭제에 실패했습니다.');
                        }
                    } catch (error) {
                        console.error('TTS 캐시 삭제 오류:', error);
                        new Notice('❌ TTS 캐시 삭제 중 오류가 발생했습니다.');
                    } finally {
                        button.setButtonText('캐시 삭제');
                        button.setDisabled(false);
                    }
                }))
            .addButton(button => button
                .setButtonText('새로고침')
                .setTooltip('캐시 정보를 새로고침합니다')
                .onClick(async () => {
                    this.updateCacheInfo(cacheInfoSetting);
                    new Notice('캐시 정보가 업데이트되었습니다.');
                }));
    }

    private async updateCacheInfo(setting: Setting): Promise<void> {
        try {
            // TTSCacheManager에서 캐시 정보 가져오기
            if (this.plugin.ttsService && 'getCacheInfo' in this.plugin.ttsService) {
                const cacheInfo = await (this.plugin.ttsService as any).getCacheInfo();
                
                // 더 자세한 캐시 정보 표시
                let detailedInfo = '';
                if (cacheInfo.totalFiles === 0) {
                    detailedInfo = '캐시된 파일이 없습니다.';
                } else {
                    detailedInfo = `파일 개수: ${cacheInfo.totalFiles}개 | 총 용량: ${cacheInfo.formattedSize}`;
                    
                    // 평균 파일 크기 계산
                    if (cacheInfo.totalFiles > 0 && cacheInfo.totalSize > 0) {
                        const avgSize = cacheInfo.totalSize / cacheInfo.totalFiles;
                        const avgFormatted = this.formatFileSize(avgSize);
                        detailedInfo += ` | 평균 크기: ${avgFormatted}`;
                    }
                }
                
                // 캐시 폴더 경로 정보도 표시
                const cacheFolder = `${this.plugin.settings.vocabularyFolderPath}/cache/tts`;
                setting.setDesc(`캐시 현황 (${cacheFolder}) - ${detailedInfo}`);
            } else {
                setting.setDesc('캐시 현황 - TTS 캐시 서비스를 사용할 수 없습니다.');
            }
        } catch (error) {
            console.error('캐시 정보 업데이트 오류:', error);
            setting.setDesc('캐시 현황 - 정보를 가져오는 중 오류가 발생했습니다.');
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private async clearTTSCache(): Promise<boolean> {
        try {
            // Google Cloud TTS 서비스에서 캐시 삭제
            if (this.plugin.ttsService && 'clearCache' in this.plugin.ttsService) {
                return await (this.plugin.ttsService as any).clearCache();
            }
            return false;
        } catch (error) {
            console.error('TTS 캐시 삭제 오류:', error);
            return false;
        }
    }

} 