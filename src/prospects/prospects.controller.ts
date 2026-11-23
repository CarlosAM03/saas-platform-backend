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
import { ResolveProspectRequest } from './dto/resolve-prospect.request';
import { ProspectHistoryQuery } from './dto/prospect-history.query';

@Controller('prospects')
@Roles('ADMIN', 'OWNER', 'MEMBER')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Post()
  @Roles('ADMIN', 'OWNER')
  create(@Body() request: CreateProspectRequest) {
    return this.prospectsService.create(request);
  }

  @Post('match')
  @Roles('ADMIN', 'OWNER')
  match(@Body() request: CreateProspectRequest) {
    return this.prospectsService.match(request);
  }

  @Post('resolve')
  @Roles('ADMIN', 'OWNER')
  resolve(@Body() request: ResolveProspectRequest) {
    return this.prospectsService.resolve(request);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.prospectsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prospectsService.findOne(id);
  }

  @Get(':id/campaigns')
  campaigns(@Param('id') id: string, @Query() query: ProspectHistoryQuery) {
    return this.prospectsService.campaignsForProspect(id, query);
  }

  @Get(':id/provenance')
  provenance(@Param('id') id: string, @Query() query: ProspectHistoryQuery) {
    return this.prospectsService.provenance(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() request: UpdateProspectRequest) {
    return this.prospectsService.update(id, request);
  }
}
