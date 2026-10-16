import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProspectRequest } from './dto/update-prospect.request';
import { ProspectsService } from './prospects.service';
import { CreateProspectRequest } from './dto/create-prospect.request';

@Controller('prospects')
@Roles('ADMIN', 'OWNER', 'MEMBER')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Post()
  @Roles('ADMIN', 'OWNER')
  create(@Body() request: CreateProspectRequest) {
    return this.prospectsService.create(request);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.prospectsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prospectsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() request: UpdateProspectRequest) {
    return this.prospectsService.update(id, request);
  }
}
