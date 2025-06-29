import { App, PluginSettingTab, Setting, Notice, TFolder } from 'obsidian';
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
    llmApiKey: string; // 범용 LLM API 키 (암호화됨)
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
    llmApiKey: '',
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

        // 범용 LLM API 키
        new Setting(containerEl)
            .setName('범용 LLM API 키')
            .setDesc('기타 LLM 서비스용 API 키를 입력하세요.')
            .addText(text => {
                const currentKey = this.plugin.settings.llmApiKey;
                const decryptedKey = decryptApiKey(currentKey);
                const maskedKey = maskApiKey(decryptedKey);
                
                return text
                    .setPlaceholder('API 키를 입력하세요...')
                    .setValue(maskedKey)
                    .onChange(async (value) => {
                        if (value !== maskedKey) {
                            const encryptedKey = encryptApiKey(value);
                            this.plugin.settings.llmApiKey = encryptedKey;
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

        const voiceSetting = new Setting(containerEl)
            .setName('음성 선택')
            .setDesc('사용할 음성을 선택하세요.')
            .setClass('tts-voice-setting')
            .addDropdown(dropdown => {
                // 실제 사용 가능한 영어 음성들을 동적으로 추가
                this.populateVoiceDropdown(dropdown);
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
                        await this.playVoicePreview();
                    } catch (error) {
                        console.error('음성 미리듣기 오류:', error);
                        new Notice('음성 재생 중 오류가 발생했습니다.');
                    } finally {
                        button.setButtonText('미리듣기');
                        button.setDisabled(false);
                    }
                }));

        const speedSetting = new Setting(containerEl)
            .setName('재생 속도')
            .setDesc('음성 재생 속도를 조절하세요. (0.5 = 느림, 1.0 = 보통, 2.0 = 빠름)')
            .setClass('tts-speed-setting')
            .addSlider(slider => slider
                .setLimits(0.5, 2.0, 0.1)
                .setValue(this.plugin.settings.ttsPlaybackSpeed)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.ttsPlaybackSpeed = value;
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText('속도 테스트')
                .setTooltip('현재 설정된 속도로 샘플 음성을 재생합니다')
                .onClick(async () => {
                    button.setButtonText('재생 중...');
                    button.setDisabled(true);
                    
                    try {
                        await this.playVoicePreview();
                    } catch (error) {
                        console.error('음성 속도 테스트 오류:', error);
                        new Notice('음성 재생 중 오류가 발생했습니다.');
                    } finally {
                        button.setButtonText('속도 테스트');
                        button.setDisabled(false);
                    }
                }));

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
        
        // 초기 상태 설정
        this.updateTTSSettingsVisibility();
    }

    private populateVoiceDropdown(dropdown: any): void {
        // 기본 옵션들 (Edge TTS와 유사한 Neural 음성들)
        const defaultOptions = [
            { value: 'en-US-AvaNeural', name: 'Ava (미국 영어)' },
            { value: 'en-US-JennyNeural', name: 'Jenny (미국 영어)' },
            { value: 'en-GB-SoniaNeural', name: 'Sonia (영국 영어)' },
            { value: 'en-GB-RyanNeural', name: 'Ryan (영국 영어)' },
            { value: 'en-AU-NatashaNeural', name: 'Natasha (호주 영어)' }
        ];

        // 기본 옵션들 추가
        defaultOptions.forEach(option => {
            dropdown.addOption(option.value, option.name);
        });

        // 실제 브라우저에서 사용 가능한 영어 음성들 추가
        try {
            const voices = speechSynthesis.getVoices();
            const englishVoices = voices.filter(voice => 
                voice.lang.startsWith('en-') && 
                !voice.lang.includes('ko') &&
                !defaultOptions.some(opt => opt.value === voice.name)
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
        
        // TTS 관련 설정들의 표시/숨김 처리
        const ttsSettings = this.containerEl.querySelectorAll('.tts-voice-setting, .tts-speed-setting, .tts-autoplay-setting');
        ttsSettings.forEach(setting => {
            const element = setting as HTMLElement;
            if (isEnabled) {
                element.style.display = '';
                element.style.opacity = '1';
            } else {
                element.style.opacity = '0.5';
                // 완전히 숨기지 않고 비활성화 상태로 표시
                const buttons = element.querySelectorAll('button');
                const dropdowns = element.querySelectorAll('select');
                const sliders = element.querySelectorAll('input[type="range"]');
                const toggles = element.querySelectorAll('input[type="checkbox"]');
                
                buttons.forEach(btn => (btn as HTMLButtonElement).disabled = true);
                dropdowns.forEach(dd => (dd as HTMLSelectElement).disabled = true);
                sliders.forEach(slider => (slider as HTMLInputElement).disabled = true);
                toggles.forEach(toggle => (toggle as HTMLInputElement).disabled = true);
            }
        });
        
        // 활성화 상태일 때 모든 컨트롤 재활성화
        if (isEnabled) {
            const ttsSettings = this.containerEl.querySelectorAll('.tts-voice-setting, .tts-speed-setting, .tts-autoplay-setting');
            ttsSettings.forEach(setting => {
                const element = setting as HTMLElement;
                const buttons = element.querySelectorAll('button');
                const dropdowns = element.querySelectorAll('select');
                const sliders = element.querySelectorAll('input[type="range"]');
                const toggles = element.querySelectorAll('input[type="checkbox"]');
                
                buttons.forEach(btn => (btn as HTMLButtonElement).disabled = false);
                dropdowns.forEach(dd => (dd as HTMLSelectElement).disabled = false);
                sliders.forEach(slider => (slider as HTMLInputElement).disabled = false);
                toggles.forEach(toggle => (toggle as HTMLInputElement).disabled = false);
            });
        }
    }

    private async playVoicePreview(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // Web Speech API 지원 확인
                if (!window.speechSynthesis) {
                    reject(new Error('이 브라우저는 음성 합성을 지원하지 않습니다.'));
                    return;
                }

                // 현재 재생 중인 음성이 있으면 중지
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                }

                // 음성 목록 로딩 대기 (TTSService와 동일한 방식)
                await this.ensureVoicesLoadedForPreview();

                // 샘플 텍스트 정의
                const sampleTexts = [
                    'Hello, this is a sample voice preview.',
                    'Welcome to English vocabulary learning.',
                    'This voice will help you learn pronunciation.',
                    'Beautiful words make beautiful sentences.'
                ];
                
                const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];

                // 음성 합성 설정
                const utterance = new SpeechSynthesisUtterance(randomText);
                
                // TTSService와 동일한 영어 음성 선택 로직 사용
                const selectedVoice = this.selectEnglishVoiceForPreview();
                
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    // voice 설정이 우선되므로 lang도 voice에 맞춰 설정
                    utterance.lang = selectedVoice.lang;
                    console.log(`Settings Preview Voice: ${selectedVoice.name} (${selectedVoice.lang})`);
                } else {
                    // 폴백: 명시적으로 영어 언어 설정
                    utterance.lang = 'en-US';
                    console.log('Settings Preview: No specific voice found, using en-US language');
                }
                
                utterance.rate = this.plugin.settings.ttsPlaybackSpeed;
                utterance.volume = 1.0;

                // 이벤트 핸들러 설정
                utterance.onend = () => {
                    resolve();
                };

                utterance.onerror = (event) => {
                    reject(new Error(`음성 재생 오류: ${event.error}`));
                };

                // 음성 재생
                speechSynthesis.speak(utterance);

                // 타임아웃 설정 (10초)
                setTimeout(() => {
                    if (speechSynthesis.speaking) {
                        speechSynthesis.cancel();
                        reject(new Error('음성 재생 타임아웃'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    private async ensureVoicesLoadedForPreview(): Promise<void> {
        return new Promise((resolve) => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve();
                return;
            }

            const handleVoicesChanged = () => {
                speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                resolve();
            };

            speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
            
            // 타임아웃 설정 (2초)
            setTimeout(() => {
                speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                resolve();
            }, 2000);
        });
    }

    private selectEnglishVoiceForPreview(): SpeechSynthesisVoice | null {
        const voices = speechSynthesis.getVoices();
        
        // 명시적 음성 이름 우선 매칭
        if (this.plugin.settings.ttsVoice) {
            const exactMatch = voices.find(voice => voice.name === this.plugin.settings.ttsVoice);
            if (exactMatch) {
                return exactMatch;
            }
        }

        // 영어 음성만 필터링 (한국어 제외)
        const englishVoices = voices.filter(voice => 
            voice.lang.startsWith('en-') && !voice.lang.includes('ko')
        );

        if (englishVoices.length === 0) {
            console.warn('Settings Preview: No English voices found');
            return null;
        }

        // 우선순위 기반 음성 선택
        const preferredVoices = [
            'Microsoft Ava - English (United States)',
            'Microsoft Jenny - English (United States)', 
            'Microsoft Aria - English (United States)',
            'Microsoft Guy - English (United States)',
            'Microsoft Mark - English (United States)',
            'Google US English',
            'en-US-AvaNeural',
            'en-US-JennyNeural',
            'en-US-AriaNeural'
        ];

        // 우선순위 음성 찾기
        for (const preferredName of preferredVoices) {
            const voice = englishVoices.find(v => 
                v.name.includes(preferredName) || v.name === preferredName
            );
            if (voice) {
                return voice;
            }
        }

        // 미국 영어 우선
        const usEnglish = englishVoices.find(voice => voice.lang === 'en-US');
        if (usEnglish) {
            return usEnglish;
        }

        // 그 외 영어 음성 중 첫 번째
        return englishVoices[0];
    }
} 