import { IsString, Matches, MaxLength } from 'class-validator';

export class PreviewProspectImportRequest {
  @IsString()
  @Matches(/^\S+$/)
  @MaxLength(200)
  campaignId!: string;
}

export class ConfirmProspectImportRequest extends PreviewProspectImportRequest {
  @IsString()
  @MaxLength(4096)
  previewReference!: string;

  // JSON array in multipart: [{"record":1,"action":"LINK_EXISTING"}].
  @IsString()
  @MaxLength(100000)
  decisions!: string;
}
