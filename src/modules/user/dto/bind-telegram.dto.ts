import { IsDefined } from 'class-validator';

export class BindTelegramDto {
  @IsDefined()
  id: string | number;
}
