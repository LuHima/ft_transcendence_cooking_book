import { SignInUserDto } from "./signin-user.dto";
import {PartialType} from "@nestjs/mapped-types"

class UpdateUserDto extends PartialType(SignInUserDto) 
{

}