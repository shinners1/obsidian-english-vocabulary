import { ILLMService, LLMConfig } from '../../core/ports/services/ILLMService';
import { LLMProvider } from '../../shared/lib/types';
import { OpenAIService } from './OpenAIService';
// import { AnthropicService } from './AnthropicService';
// import { GoogleAIService } from './GoogleAIService';

export class LLMServiceFactory {
    private static instances: Map<LLMProvider, ILLMService> = new Map();
    private static configs: Map<LLMProvider, LLMConfig> = new Map();

    /**
     * LLM 서비스 인스턴스를 생성하거나 기존 인스턴스를 반환합니다
     */
    static createService(provider: LLMProvider, config: LLMConfig): ILLMService {
        let service = this.instances.get(provider);
        
        if (!service) {
            service = this.instantiateService(provider);
            this.instances.set(provider, service);
        }
        
        // 설정 업데이트
        service.configure(config);
        this.configs.set(provider, config);
        
        return service;
    }

    /**
     * 특정 LLM 서비스 인스턴스를 가져옵니다
     */
    static getService(provider: LLMProvider): ILLMService | null {
        return this.instances.get(provider) || null;
    }

    /**
     * 모든 설정된 LLM 서비스들을 가져옵니다
     */
    static getAllServices(): Map<LLMProvider, ILLMService> {
        return new Map(this.instances);
    }

    /**
     * 특정 provider의 서비스가 설정되어 있는지 확인합니다
     */
    static isServiceConfigured(provider: LLMProvider): boolean {
        const service = this.instances.get(provider);
        return service ? service.isConfigured() : false;
    }

    /**
     * 설정된 모든 서비스 provider 목록을 가져옵니다
     */
    static getConfiguredProviders(): LLMProvider[] {
        return Array.from(this.instances.keys()).filter(provider => 
            this.isServiceConfigured(provider)
        );
    }

    /**
     * 가장 우선순위가 높은 사용 가능한 LLM 서비스를 가져옵니다
     */
    static getPreferredService(): ILLMService | null {
        const priorityOrder: LLMProvider[] = ['openai', 'anthropic', 'google'];
        
        for (const provider of priorityOrder) {
            const service = this.instances.get(provider);
            if (service && service.isConfigured()) {
                return service;
            }
        }
        
        return null;
    }

    /**
     * 특정 provider의 설정을 업데이트합니다
     */
    static updateServiceConfig(provider: LLMProvider, config: LLMConfig): void {
        const service = this.instances.get(provider);
        if (service) {
            service.configure(config);
            this.configs.set(provider, config);
        }
    }

    /**
     * 특정 provider의 서비스를 제거합니다
     */
    static removeService(provider: LLMProvider): void {
        const service = this.instances.get(provider);
        if (service) {
            service.clearCache?.();
            this.instances.delete(provider);
            this.configs.delete(provider);
        }
    }

    /**
     * 모든 서비스를 제거합니다
     */
    static clearAllServices(): void {
        for (const service of this.instances.values()) {
            service.clearCache?.();
        }
        this.instances.clear();
        this.configs.clear();
    }

    /**
     * 특정 provider의 현재 설정을 가져옵니다
     */
    static getServiceConfig(provider: LLMProvider): LLMConfig | null {
        return this.configs.get(provider) || null;
    }

    /**
     * 모든 서비스의 설정을 가져옵니다
     */
    static getAllConfigs(): Map<LLMProvider, LLMConfig> {
        return new Map(this.configs);
    }

    /**
     * 서비스들의 상태 정보를 가져옵니다
     */
    static getServicesStatus(): {
        provider: LLMProvider;
        configured: boolean;
        hasCache: boolean;
        remainingRequests?: number;
    }[] {
        const status = [];
        
        for (const [provider, service] of this.instances) {
            status.push({
                provider,
                configured: service.isConfigured(),
                hasCache: service.getCachedResult?.('test') !== undefined,
                remainingRequests: service.getRemainingRequests?.()
            });
        }
        
        return status;
    }

    /**
     * 모든 서비스의 캐시를 지웁니다
     */
    static clearAllCaches(): void {
        for (const service of this.instances.values()) {
            service.clearCache?.();
        }
    }

    /**
     * 서비스를 테스트합니다
     */
    static async testService(provider: LLMProvider): Promise<{ success: boolean; error?: string }> {
        const service = this.instances.get(provider);
        if (!service) {
            return { success: false, error: '서비스가 생성되지 않았습니다.' };
        }

        if (!service.isConfigured()) {
            return { success: false, error: '서비스가 설정되지 않았습니다.' };
        }

        try {
            const testWord = 'test';
            const result = await service.getWordDetails(testWord);
            return { success: result.success, error: result.error };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : '알 수 없는 오류' 
            };
        }
    }

    /**
     * 기본 설정으로 서비스를 초기화합니다
     */
    static initializeWithDefaults(): void {
        // OpenAI 서비스 기본 인스턴스 생성
        if (!this.instances.has('openai')) {
            this.instances.set('openai', new OpenAIService());
        }

        // 다른 서비스들도 필요시 기본 인스턴스 생성
        // if (!this.instances.has('anthropic')) {
        //     this.instances.set('anthropic', new AnthropicService());
        // }
        // if (!this.instances.has('google')) {
        //     this.instances.set('google', new GoogleAIService());
        // }
    }

    /**
     * LLM 서비스 인스턴스를 실제로 생성하는 private 메서드
     */
    private static instantiateService(provider: LLMProvider): ILLMService {
        switch (provider) {
            case 'openai':
                return new OpenAIService();
            
            case 'anthropic':
                // return new AnthropicService();
                throw new Error('Anthropic 서비스는 아직 구현되지 않았습니다.');
            
            case 'google':
                // return new GoogleAIService();
                throw new Error('Google AI 서비스는 아직 구현되지 않았습니다.');
            
            default:
                throw new Error(`지원하지 않는 LLM provider: ${provider}`);
        }
    }

    /**
     * 팩토리 초기화 (앱 시작 시 호출)
     */
    static initialize(): void {
        this.initializeWithDefaults();
        console.log('LLMServiceFactory 초기화 완료');
    }

    /**
     * 팩토리 정리 (앱 종료 시 호출)
     */
    static dispose(): void {
        this.clearAllServices();
        console.log('LLMServiceFactory 정리 완료');
    }
}

// 기본 설정으로 초기화
LLMServiceFactory.initialize(); 