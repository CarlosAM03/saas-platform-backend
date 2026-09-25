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
import {
  CreateCampaignRequest,
  DeleteCampaignQuery,
  UpdateCampaignRequest,
} from './dto/campaign.request';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
@Roles('ADMIN', 'OWNER', 'MEMBER')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.campaigns.findAll(query);
  }

  @Post()
  create(@Body() request: CreateCampaignRequest) {
    return this.campaigns.create(request);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() request: UpdateCampaignRequest) {
    return this.campaigns.update(id, request);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query() query: DeleteCampaignQuery) {
    return this.campaigns.remove(id, query.permanent);
  }

  @Get(':id/prospects')
  findProspects(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.campaigns.findProspects(id, query);
  }
}
