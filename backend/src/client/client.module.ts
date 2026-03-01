import { Module } from '@nestjs/common';
import { ClientService } from './client.service.js';
import { ClientController } from './client.controller.js';

@Module({
    providers: [ClientService],
    controllers: [ClientController],
    exports: [ClientService],
})
export class ClientModule { }
