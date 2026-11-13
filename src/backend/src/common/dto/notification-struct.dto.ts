import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class NotificationStructDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  id_user: number; // di chi è l'azione

  @IsInt()
  @IsPositive()
  id_target: number; // ricetta, commento o un altro utente

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string | null; // testo extra, per ora usato solo dal warn
}
