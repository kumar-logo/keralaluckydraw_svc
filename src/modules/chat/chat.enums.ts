export enum GroupType {
  Public = 'public',
  Private = 'private',
}

export enum JoinPolicy {
  Auto = 'auto',
  Open = 'open',
  Invite = 'invite',
}

export enum Visibility {
  Listed = 'listed',
  Unlisted = 'unlisted',
}

export enum PostPolicy {
  All = 'all',
  AdminOnly = 'admin_only',
}

export enum MessageKind {
  Text = 'text',
  Image = 'image',
  Voice = 'voice',
  System = 'system',
}

export enum SenderRole {
  User = 'user',
  Admin = 'admin',
}

export enum MemberRole {
  Member = 'member',
  Admin = 'admin',
}

export enum DmScope {
  Mine = 'mine',
  Queue = 'queue',
}
