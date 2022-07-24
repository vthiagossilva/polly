import { PoolClient, QueryConfig } from "pg";
import { PoolManager } from "./manager";


export class Polly {
    protected pool: PoolManager;
    protected client: PoolClient | null
    protected autoRelease: boolean
    protected inTransaction: boolean

    constructor(config: {
        pool: PoolManager,
        autoRelease?: boolean
    }) {
        this.pool = config.pool;
        this.client = null;
        this.autoRelease = config.autoRelease !== false;
        this.inTransaction = false;
    }

    protected async getClient(): Promise<PoolClient> {
        if (!this.client) {
            this.client = await this.pool.acquire();
        }
        return this.client;
    }

    protected async execute(query: string | QueryConfig, params?: any) {
        const client = await this.getClient();

        try {
            return client.query(query, params);
        } catch(err) {
            if (this.inTransaction) {
                client.query('ROLLBACK');
                this.inTransaction = false;
            }
            this.free();

            throw err;
        } finally {
            if (this.autoRelease && !this.inTransaction) {
                this.free();
            }
        };
    }

    public async startTransaction() {
        this.inTransaction = true;
        await this.execute('BEGIN');
    }

    public async commit() {
        if (this.inTransaction) {
            this.inTransaction = false;
            await this.execute('COMMIT');
        }
    }

    public free() {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
    }

    public async count(config: {
        table: string,
        where?: string,
        pk?: string,
        params?: QueryParams
    }): Promise<number> {
        const result = await this.select({
            query: `
                SELECT COUNT(${config.pk ?? 'id'}) as count FROM ${config.table}
                ${config.where ? `WHERE ${config.where}` : ''};
            `,
            params: config.params,
        });
        return result[0].count;
    };

    public async getOne(config: {
        query: string,
        params?: QueryParams,
        orderBy?: string,
        orderByDesc?: boolean,
    }) {
        const result = await this.select({
            query: config.query,
            params: config.params,
            limit: 1,
            orderBy: config.orderBy,
            orderByDesc: config.orderByDesc
        })

        if (result.length > 0) {
            return result[0];
        }
        return null;
    }

    public async select(config: {
        query: string,
        params?: QueryParams,
        limit?: number,
        skip?: number,
        orderBy?: string,
        orderByDesc?: boolean,
    }) {
        return (await this.execute(`
            ${config.query}
            ${!!config.orderBy ? `ORDER BY ${config.orderBy} ${config.orderByDesc ? 'DESC' : ''}` : ''}
            ${!!config.limit ? `LIMIT ${config.limit}`: ''}
            ${!!config.skip ? `OFFSET ${config.skip}` : ''}
        `, config.params)).rows;
    };

    public async insert(config: {
        table: string,
        data: object | object[],
        getID?: boolean,
    }) {
        const [ _fields, _values ] = Polly.getData(config.data);
        const sql = `
            INSERT INTO ${config.table}
                (${_fields.join(',')})
                VALUES (${_values.join(',')})${config.getID ? ' RETURNING id' : ''};`
        const result = await this.execute(sql);
        if (config.getID && result.rows.length === 1) {
            return result.rows[0].id;
        }
    }

    public async update(config: {
        table: string,
        data: object,
        where: string | null,
        params?: QueryParams,
    }) {
        const [ fields, _data ] = Polly.getData(config.data);
    
        const sql = `UPDATE ${config.table}
            SET ${fields.map((f, i) => `${f} = ${_data[i]}`)}
            ${config.where ? `WHERE ${config.where}` : ''};`;
        
        await this.execute(sql, config.params);
    }

    public async delete(config: {
        table: string,
        where: string | null,
        params?: QueryParams,
    }) {
        const sql = `DELETE FROM ${config.table}
            ${config.where ? `WHERE ${config.where}` : ''};`;
        
        await this.execute(sql,config.params);
    }

    public static getData(data: any) {
        const converter = (o: any) => {
            if (typeof o === 'object') {
                return Object.prototype.toString.call(o) === '[object Date]' ? 
                    o.toISOString() : JSON.stringify(o);
            } else if (o === null) {return o};
            return o.toString().replace(/'/g, "''");
        }

        let _fields: string[] = [];
        const _data: any[] = [];
        if (!(Object.prototype.toString.call(data) === '[object Array]')) {
            for (let par of Object.keys(data)) {
                if (data[par] !== undefined) {
                    _fields.push(`"${par.toLowerCase()}"`);
                    const value = converter(data[par]);
                    if (data[par] === null) {
                        _data.push('null');
                    } else {
                        _data.push(`'${value}'`);
                    }
                }
            }
            return [ _fields, _data ];
        }

        for (let item of data) {
            const _value: any[] = [];

            for (let par of Object.keys(item)) {
                if (_fields.length < Object.keys(item).length) {
                    _fields = Object.keys(item).map(a => `"${a.toLowerCase()}"`);
                }
                const value = converter(item[par]);
                
                if (value === null) {
                    _value.push('null');
                } else {
                    _value.push(`'${value}'`);
                }
            }
            _data.push(_value);
        }
        return [ _fields, _data ];
    }    
};

export type QueryParams = (string | number | object | boolean)[];
