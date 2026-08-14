export enum SeamlessEvent {
  GameTransaction = 'game_transaction',
}

export enum SeamlessCode {
  Ok = 0,
  ServerError = 2,
  UserNotFound = 4,
  MissingFields = 7,
  InsufficientBalance = 305,
}

export enum SeamlessMessage {
  Ok = 'OK',
  MissingFields = 'Missing fields',
  UserNotFound = 'User not found',
  InsufficientBalance = 'single wallet balance not enough',
  ServerError = 'Database error',
  GameLaunchFailed = 'Game launch failed',
  GameUnavailable = 'This game is not available yet',
}

export enum LaunchReturnType {
  Url = 1,
}

export enum AggregatorCode {
  Success = 0,
}
