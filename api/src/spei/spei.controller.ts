import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SpeiService } from './spei.service';
import { CreateSpeiOrderDto } from './dto/create-spei-order.dto';

@Controller('spei')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SpeiController {
  constructor(private readonly spei: SpeiService) {}

  @Get('status')
  getServiceStatus() {
    return { configured: this.spei.isConfigured, mode: this.spei.isConfigured ? 'live' : 'stub' };
  }

  @Post('order')
  @Roles('SUPERADMIN', 'CORPORATE_ADMIN')
  async createOrder(@Body() dto: CreateSpeiOrderDto) {
    return this.spei.order(dto);
  }

  @Get('order/:claveRastreo')
  @Roles('SUPERADMIN', 'CORPORATE_ADMIN')
  async getOrderStatus(@Param('claveRastreo') claveRastreo: string) {
    return this.spei.getStatus(claveRastreo);
  }
}
