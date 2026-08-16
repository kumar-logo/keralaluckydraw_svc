export interface ChatDeliveredPayload {
  groupId: number;
  userId: string;
  lastDeliveredId: number;
}

export interface ChatGroupUpdatePayload {
  groupId: number;
  name: string;
  avatar: string;
  description: string;
  type: string;
  joinPolicy: string;
  postPolicy: string;
  visibility: string;
}

export interface ChatJoinedPayload {
  groupId: number;
  userId: string;
}

export interface ChatLeftPayload {
  groupId: number;
  userId: string;
}

export interface ChatDmCreatedPayload {
  groupId: number;
  dmKey: string;
  userId: string;
  scope: string;
}

export interface ChatDmClaimedPayload {
  groupId: number;
  adminId: string;
}

export interface ChatMentionBadgePayload {
  groupId: number;
}

export type ChatEventPayload =
  | ChatDeliveredPayload
  | ChatGroupUpdatePayload
  | ChatJoinedPayload
  | ChatLeftPayload
  | ChatDmCreatedPayload
  | ChatDmClaimedPayload
  | ChatMentionBadgePayload;
