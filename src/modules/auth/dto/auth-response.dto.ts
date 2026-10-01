import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ description: 'JWT access token (short lived)' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token (long lived, stored hashed)' })
  refreshToken: string;
}
