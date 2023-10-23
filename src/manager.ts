import { Pool, PoolClient, PoolConfig } from 'pg';


export class PoolManager {
    private pool: Pool;
    public logQueries: boolean;

    constructor(config: PoolConfig) {
        this.pool = new Pool(config);
        this.logQueries = !!process.env.LOG_QUERIES;
    }

    public async onReady(executor: () => void) {
        this.pool.on('connect', executor);
    }

    public async acquire(): Promise<PoolClient> {
        return this.pool.connect();
    };

    public release(client: PoolClient) {
        client.release();
    }
};