require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Test 1: Direct instantiation
console.log('Test 1: Direct PrismaClient with adapter...');
const pool1 = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter1 = new PrismaPg(pool1);
const direct = new PrismaClient({ adapter: adapter1 });

direct.user.findFirst({ where: { email: 'admin@petropolis.com.br' } })
    .then(u => {
        console.log('Test 1 SUCCESS:', u?.name);
        return direct.$disconnect();
    })
    .then(() => {
        // Test 2: Class extension
        console.log('\nTest 2: Extended PrismaClient with adapter...');
        class ExtPrisma extends PrismaClient {
            constructor() {
                const pool = new Pool({ connectionString: process.env.DATABASE_URL });
                const adapter = new PrismaPg(pool);
                super({ adapter });
            }
        }
        const ext = new ExtPrisma();
        return ext.user.findFirst({ where: { email: 'admin@petropolis.com.br' } })
            .then(u => {
                console.log('Test 2 SUCCESS:', u?.name);
                return ext.$disconnect();
            });
    })
    .catch(e => {
        console.error('ERROR:', e.message);
        console.error('STACK:', e.stack);
        process.exit(1);
    });
