import type { DeliveryStatus, OnboardingStatus } from '@prisma/client';

/** Closed public projection. Never return Prisma onboarding/token rows. */
export interface TenantOnboardingResponse {
  tenantId: string;
  ownerUserId: string;
  ownerEmail: string;
  activationStatus: OnboardingStatus;
  deliveryStatus: DeliveryStatus;
  createdAt: Date;
  lastAttemptAt: Date | null;
  providerAcceptedAt: Date | null;
  activationLinkExpiresAt: Date | null;
  completedAt: Date | null;
}
