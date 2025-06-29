export type Constructor<T = {}> = new (...args: any[]) => T;
export type Factory<T = any> = (...args: any[]) => T;

export interface ServiceDefinition<T = any> {
    implementation: Constructor<T> | Factory<T>;
    singleton?: boolean;
    dependencies?: string[];
}

export class DIContainer {
    private services = new Map<string, ServiceDefinition>();
    private instances = new Map<string, any>();

    register<T>(
        name: string, 
        implementation: Constructor<T> | Factory<T>,
        options: { singleton?: boolean; dependencies?: string[] } = {}
    ): void {
        this.services.set(name, {
            implementation,
            singleton: options.singleton ?? true,
            dependencies: options.dependencies ?? []
        });
    }

    resolve<T>(name: string): T {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not registered`);
        }

        // 싱글톤이고 이미 인스턴스가 있으면 반환
        if (service.singleton && this.instances.has(name)) {
            return this.instances.get(name);
        }

        // 의존성 해결
        const dependencies = service.dependencies.map(dep => this.resolve(dep));

        // 인스턴스 생성
        let instance: T;
        if (this.isConstructor(service.implementation)) {
            instance = new service.implementation(...dependencies);
        } else {
            instance = service.implementation(...dependencies);
        }

        // 싱글톤이면 인스턴스 저장
        if (service.singleton) {
            this.instances.set(name, instance);
        }

        return instance;
    }

    registerInstance<T>(name: string, instance: T): void {
        this.instances.set(name, instance);
        this.services.set(name, {
            implementation: () => instance,
            singleton: true,
            dependencies: []
        });
    }

    has(name: string): boolean {
        return this.services.has(name);
    }

    clear(): void {
        this.services.clear();
        this.instances.clear();
    }

    private isConstructor(implementation: any): implementation is Constructor {
        return implementation.prototype && implementation.prototype.constructor === implementation;
    }
}

// 글로벌 컨테이너 인스턴스
export const container = new DIContainer();