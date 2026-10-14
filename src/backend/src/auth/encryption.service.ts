import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { errorMonitor } from 'events';
import { createHttpException, errors } from 'src/common/config/error.config';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey = Buffer.from(
    process.env.TWO_FACTOR_AUTH!,
    'hex',
  );

  // https://nodejs.org/api/crypto.html#cipherfinaloutputencoding per info
  public encrypting(secret: string) {
    const iv = crypto.randomBytes(12); // Genera un IV casuale che dovrebbe essere un punto
    // di partenza per decryptare la chiave (Non uso la stessa tenendola nell'env perche altrimenti
    // anche se ottieni 2 chiavi diverse nel database facendo il confronto tra queste 2 chiavi puoi ricavarti l'altra)

    // creo il l'oggetto per cifrare i miei valori
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    // uso l'algoritmo aes-256-gcm perche è lo standard

    // cifro il mio codice segreto
    let encrypt = cipher.update(secret, 'utf8', 'hex');
    encrypt += cipher.final('hex');

    // creao l'auto tag per assicurarmi nel database che la stringa non sia mai stata modificata
    // o attaccata in alcun modo
    const authTag = cipher.getAuthTag().toString('hex');

    // Unisce IV, AuthTag e testo cifrato, separandolo con i 2 punti
    const ret_str = iv.toString('hex') + ':' + authTag + ':' + encrypt;

    return ret_str;
  }
  //	l'obbietivo è creare un stringadi questo tipo per decryptare la chiave
  /* 

[ Il Secret ]		+			[ L'autoTag ]		+		[ L'IV (Casuale) ]

  il codice generato		Garantisce che il 			Il punto di partenza per 
	da proteggere			sigillo non sia 			garantire che nessuna chiave
								manomesso				sia simile se, ci fossere 2 
														password uguali il codice verrebe
														uguale altrimenti
	
che garantisce la rileggibilita e l'impredivibilita del codice, anche per gli
algoritmi di hashing visto che chiunque ha l'env puo revertire il codice
*/

  public decrypting(twoFactorCode: string | null): string {
    if (!twoFactorCode) throw createHttpException(errors.auth.accessDenied);
    try {
      // spezzo il codice
      //ricavo l'IV e l'AuthTag da stringhe esadecimali
      const array = twoFactorCode.split(':');
      const ivTemp = array[0];
      const authTagTemp = array[1];
      const keyTemp = array[2];

      //  ivTemp è una stringa esadecimale letta dal DB
      // La riconverto in un Buffer perché crypto.createDecipheriv richiede byte, non del semplice testo
      // stessa cosa per authTag
      const iv = Buffer.from(ivTemp, 'hex');
      const authTag = Buffer.from(authTagTemp, 'hex');

      // Creo il decifratore usando lo stesso algoritmo
      // la stessa chiave env e lo stesso IV cryptato per dare il punto di partenza
      // Cosi da usare questo oggetto per decryptare ogni parte della chiave in parte per parte
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        iv,
      );

      // Imposto il sigillo di garanzia: se il testo nel DB è stato manomesso, darà errore qui!
      // Si usa solo per verificare l'integrita non per descryptare il codice
      decipher.setAuthTag(authTag);

      //Decifro la chiave da 'hex' a 'utf8' (testo leggibile)!
      let decrypted = decipher.update(keyTemp, 'hex', 'utf8');

      //		Qui final controlla che la stringa non sia manomessa e che tutto sia a norma altrimenti lancia una exeption
      decrypted += decipher.final('utf8');

      // 6. Restituisco la chiave non protetta
      return decrypted;
    } catch (error) {
      throw createHttpException(
        errors.auth.accessDenied,
        'Unable to decrypt the key, the data might be corrupted',
      );
    }
  }
  /* 
												ATTENZIONE 
	final puo essre usato solo una volta per motivi di sicureza, l'oggetto cipher o decipher viene disattivato
	dopo l'utilizzo di final	
	*/
}
