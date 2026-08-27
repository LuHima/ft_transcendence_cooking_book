import { registerUserDto } from "./register-user.dto";
import {PartialType} from "@nestjs/mapped-types"

class updateUserDto extends PartialType(registerUserDto) 
{

}