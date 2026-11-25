import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateCampaignRequest,
  DeleteCampaignQuery,
  UpdateCampaignRequest,
} from './dto/campaign.request';
import { CampaignsService } from './campaigns.service';
import {
  AssignResponsibleRequest,
  CreateCampaignActivityRequest,
  UpdateEvaluationRequest,
  UpdateStageRequest,
} from './dto/campaign-participation.request';
import { CampaignProspectsQuery } from './dto/campaign-prospects.query';

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
  findProspects(
    @Param('id') id: string,
    @Query() query: CampaignProspectsQuery,
  ) {
    return this.campaigns.findProspects(id, query);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.campaigns.dashboard(id);
  }

  @Get(':campaignId/prospects/:prospectId/participation')
  participation(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
  ) {
    return this.campaigns.getParticipation(campaignId, prospectId);
  }

  @Patch(':campaignId/prospects/:prospectId/stage')
  updateStage(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
    @Body() request: UpdateStageRequest,
  ) {
    return this.campaigns.updateStage(campaignId, prospectId, request.stage);
  }

  @Patch(':campaignId/prospects/:prospectId/evaluation')
  updateEvaluation(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
    @Body() request: UpdateEvaluationRequest,
  ) {
    return this.campaigns.updateEvaluation(
      campaignId,
      prospectId,
      request.evaluation,
      request.reason,
    );
  }

  @Get(':campaignId/prospects/:prospectId/responsibles')
  eligibleResponsibles(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
  ) {
    return this.campaigns.eligibleResponsibles(campaignId, prospectId);
  }

  @Put(':campaignId/prospects/:prospectId/responsible')
  assignResponsible(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
    @Body() request: AssignResponsibleRequest,
  ) {
    return this.campaigns.assignResponsible(
      campaignId,
      prospectId,
      request.responsibleId,
    );
  }

  @Delete(':campaignId/prospects/:prospectId/responsible')
  removeResponsible(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
  ) {
    return this.campaigns.assignResponsible(campaignId, prospectId, null);
  }

  @Get(':campaignId/prospects/:prospectId/activities')
  activities(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
    @Query() query: PaginationDto,
  ) {
    return this.campaigns.activities(campaignId, prospectId, query);
  }

  @Post(':campaignId/prospects/:prospectId/activities')
  createActivity(
    @Param('campaignId') campaignId: string,
    @Param('prospectId') prospectId: string,
    @Body() request: CreateCampaignActivityRequest,
  ) {
    return this.campaigns.createActivity(campaignId, prospectId, request);
  }
}
