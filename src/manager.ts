import { Pool, PoolClient, PoolConfig } from 'pg';


export class PoolManager {
    private pool: Pool;

    constructor(config: PoolConfig) {
        this.pool = new Pool(config);
    }

    public async acquire(): Promise<PoolClient> {
        return this.pool.connect();
    };

    public release(client: PoolClient) {
        client.release();
    }
};