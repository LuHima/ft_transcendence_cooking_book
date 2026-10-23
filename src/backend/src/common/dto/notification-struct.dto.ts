import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class NotificationStructDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  id_user: number; // di chi è l'azione

  @IsInt()
  @IsPositive()
  id_target: number; // ricetta, commento o un altro utente
}
