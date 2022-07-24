import { Polly } from './polly';
import { PoolManager } from './manager';


const pool = new PoolManager({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 8,
    idleTimeoutMillis: 100,
    connectionTimeoutMillis: 500,
});


export function getPolly(autoRelease: boolean = true): Polly {
    return new Polly({
        pool,
        autoRelease,
    });
};