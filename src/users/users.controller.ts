import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateUserRequest } from './dto/create-user.request';
import { UpdateUserRequest } from './dto/update-user.request';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'OWNER', 'MEMBER')
  findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ search }, pagination);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@Body() request: CreateUserRequest) {
    return this.usersService.create(request);
  }

  @Get(':id')
  @Roles('ADMIN', 'OWNER', 'MEMBER')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() request: UpdateUserRequest) {
    return this.usersService.update(id, request);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
