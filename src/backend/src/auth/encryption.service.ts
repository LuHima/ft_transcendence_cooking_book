import { Injectable, UnauthorizedException, ConflictException, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpUserDto } from 'src/users/dto/signup-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { generateSecret, generateURI, verify, } from 'otplib';

import { createHttpException, errors } from 'src/common/config/error.config';
import { ChildProcess } from 'child_process';

@Injectable()
export class EncryptionService {

	private readonly encryptionKey = Buffer.from(process.env.TWO_FACTOR_ENCRYPTION_KEY!, 'hex');
	
	// https://nodejs.org/api/crypto.html#cipherfinaloutputencoding per info
	public encrypting(secret: string)
	{
		const iv = crypto.randomBytes(12); // Genera un IV casuale che dovrebbe essere un punto 
		// di partenza per decryptare la chiave (Non uso la stessa tenendola nell'env perche altrimenti 
		// anche se ottieni 2 chiavi diverse nel database facendo il confronto tra queste 2 chiavi puoi ricavarti l'altra)
		
		// creo il l'oggetto per cifrare i miei valori
		const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
		// uso l'algoritmo aes-256-gcm perche è lo standard 

		// cifro il mio codice segreto
		let encrypt = cipher.update(secret, 'utf8', 'hex')
		encrypt += cipher.final('hex');

		const authTag = cipher.getAuthTag().toString('hex');

		 // Unisce IV, AuthTag e testo cifrato
		return `${iv.toString('hex')}:${authTag}:${encrypt}`;
	}
//	l'obbietivo è creare un stringadi questo tipo
/* 

[ Il Secret ]			+  [ La Chiave Master (.env) ]	+  [ L'IV (Casuale) ]

  il codice generato		La chiave dell'env			Il punto di partenza per 
	da proteggere			per decifrare il			garantire che nessuna chiave
								codice					sia simile se  ci fossere 2 
														password uguali il codice verrebe
														uguale altrimenti
	
che garantisce la rileggibilita e l'impredivibilita del codice, anche per gli
algoritmi di hashing visto che chiunque ha l'env puo revertire il codice
*/

	public decrypting(twoFactorCode: string): string
	{
		// spezzo il codice

		//ricavo l'IV e l'AuthTag da stringhe esadecimali a Buffer di byte
		let splitedTwoFactorCode = twoFactorCode.split(':');
		const iv = Buffer.from(splitedTwoFactorCode[0], 'hex');
		const authTag =  Buffer.from(splitedTwoFactorCode[1], 'hex');

		//
		crypto.createDecipheriv(splitedTwoFactorCode[0],)
		return 'hello';
	}

}