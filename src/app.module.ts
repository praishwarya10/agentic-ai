import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { SystemHealthCheck } from './health/system.health.js';
import { MachineModule } from './modules/machine/machine.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';

/**
 * Root Application Module
 * 
 * This is the main module that bootstraps the MCP server.
 * It registers all feature modules and health checks.
 */
@McpApp({
  module: AppModule,
  server: {
    name: 'factorybrain-server',
    version: '1.0.0'
  },
  logging: {
    level: 'info'
  }
})
@Module({
  name: 'app',
  description: 'Root application module',
  imports: [
    ConfigModule.forRoot(),
    MachineModule,
    MaintenanceModule,
  ],
  providers: [
    // Health Checks
    SystemHealthCheck,
  ]
})
export class AppModule {}
