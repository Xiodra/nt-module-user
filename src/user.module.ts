import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { GraphQLModule } from '@nestjs/graphql';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthService, AuthStrategy } from './auth';
import { PERMISSION_DEFINITION, RESOURCE_DEFINITION } from './decorators';
import { Permission, Resource, Role, User } from './entities';
import { AuthenticationGurad } from './gurads/authentication.gurad';
import { UserResolver } from './resolvers/user.resolver';
import { UserService } from './services/user.service';
import { CryptoUtil } from './utils/crypto.util';

@Module({
    imports: [
        GraphQLModule,
        TypeOrmModule.forFeature([User, Role, Resource, Permission]),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: '123456',
            database: 'postgres',
            entities: ['./**/*.entity.ts'],
            maxQueryExecutionTime: 1000,
            // synchronize: true,
            // dropSchema: true,
            logging: true,
            logger: 'advanced-console'
        })
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: AuthenticationGurad
        },
        AuthService, AuthStrategy,
        UserResolver, UserService,
        CryptoUtil
    ],
    exports: []
})
export class UserModule implements OnModuleInit {
    private userModuleLogger: Logger;
    private readonly metadataScanner: MetadataScanner;

    constructor(
        @Inject(ModulesContainer) private readonly modulesContainer: ModulesContainer,
        @InjectRepository(Resource) private readonly resourceRepo: Repository<Resource>,
        @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>
    ) {
        this.userModuleLogger = new Logger('UserModule');
        this.metadataScanner = new MetadataScanner();
    }

    onModuleInit() {
        const resourceMap = new Map();
        const permissionMap = new Map();
        // 遍历 Module
        this.modulesContainer.forEach(value => {
            // 遍历 Module 中的 components
            value.components.forEach(value => {
                // 判断当前 component 是否是 Resolver 或 Controller
                const isResolverOrController =
                    Reflect.getMetadataKeys(value.instance.constructor)
                        .filter(key => ['graphql:resolver_type', 'path']
                            .indexOf(key) !== -1).length > 0;

                if (isResolverOrController) {
                    // 获取 Resolver 或 Controller 类上 @Resource() 注解中的元数据
                    const resource = Reflect.getMetadata(RESOURCE_DEFINITION, value.instance.constructor);
                    // 如果元数据存在，则添加到资源集合中，此时会根据 resource.indetify 自动去重
                    if (resource) resourceMap.set(resource.identify, resource);
                    // 获取 Resolver 或 Controller 类的原型对象
                    const prototype = Object.getPrototypeOf(value.instance);
                    if (prototype) {
                        // 获取 Resolver 或 Controller 类中的方法名，回调函数中的 name 是当前类中的方法名
                        this.metadataScanner.scanFromPrototype(value.instance, prototype, name => {
                            // 获取 Resolver 或 Controller 类中方法上的 @Permission() 注解中的元数据
                            const permission = Reflect.getMetadata(PERMISSION_DEFINITION, value.instance, name);
                            // 如果元数据存在，则添加到权限集合中，此时会根据 permission.indetify 自动去重
                            if (permission) permissionMap.set(permission.identify, permission);
                        });
                    }
                }
            });
        });

        // 保存所有扫描到的资源定义
        resourceMap.forEach(resource => {
            this.resourceRepo.save(this.resourceRepo.create(resource))
                .catch(error => {
                    this.userModuleLogger.error('Resouce: ' + error.detail);
                });
        });

        // 保存所有扫描到的权限定义
        permissionMap.forEach(permission => {
            this.permissionRepo.save(this.permissionRepo.create(permission))
                .catch(error => {
                    this.userModuleLogger.error('Permission: ' + error.detail);
                });
        });
    }
}