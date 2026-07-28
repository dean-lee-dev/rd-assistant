import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * 应用入口：启动根组件并注入全局配置。
 */
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
