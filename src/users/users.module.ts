import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordService } from '../auth/password.service';
import { RoleService } from './services/role.service';
import { UserTenantService } from './services/user-tenant.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [UsersController],
  providers: [UsersService, UserTenantService, RoleService, PasswordService],
  exports: [UsersService, UserTenantService, RoleService],
})
export class UsersModule {}
