import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProspectRequest } from './dto/update-prospect.request';
import { ProspectsService } from './prospects.service';

@Controller('prospects')
@Roles('ADMIN', 'OWNER', 'MEMBER')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

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
