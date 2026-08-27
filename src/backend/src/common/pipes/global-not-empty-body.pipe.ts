import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';

    @Injectable()                                                                             
    export class GlobalNotEmptyBodyPipe implements PipeTransform {                            
      transform(value: any, metadata: ArgumentMetadata) {                                     
        // Applica il controllo solo al @Body() delle richieste HTTP                          
        if (metadata.type === 'body') {                                                       
          if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {       
            throw new BadRequestException('The body of the request can not be empty');  
          }                                                                                   
        }                                                                                     
        return value;                                                                         
      }                                                                                       
    }   