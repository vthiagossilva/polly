import { PoolClient, QueryConfig } from "pg";
import { Converters } from "./converters";
import { PoolManager } from "./manager";
import { Where } from "./wheres";


export class Polly {
    protected pool: PoolManager;
    protected client: PoolClient | null
    protected autoRelease: boolean
    public inTransaction: boolean
    protected useCamelConverter: boolean;
    protected oneEngine?: {
        info: (message: any) => void
    };
    protected logs: string[];
    dryRun: boolean;

    constructor(config: {
        pool: PoolManager,
        autoRelease?: boolean,
        useCamelConverter?: boolean,
        engine?: any,
        dryRun?: boolean,
    }) {
        this.pool = config.pool;
        this.client = null;
        this.autoRelease = config.autoRelease !== false;
        this.inTransaction = false;
        this.useCamelConverter = config.useCamelConverter ?? false;
        this.oneEngine = config.engine;
        this.logs = [];
        this.dryRun = config.dryRun ?? false;
    }

    public getLogs() {
        return this.logs;
    }

    protected async getClient(): Promise<PoolClient> {
        if (!this.client) {
            this.client = await this.pool.acquire();
        }
        return this.client;
    }

    private async execute(query: string | QueryConfig, params?: any) {
        const parsedQuery = String(query)
            .replace(/[\r\n]+/g, '')
            .replace(/\s+/g, ' ').trim();
        let log = parsedQuery;
        if (params) {
            log += ` - [ ${params} ]`;
        }
        
        if (this.pool.logQueries) {
            if (this.oneEngine) {
                this.oneEngine.info(log);
            } else {
                console.info(log);
            }
        }
        this.logs.push(log);

        if (!this.dryRun) {
            return this.execute(parsedQuery, params);
        }
    }

    public async _execute(query: string | QueryConfig, params?: any) {
        const client = await this.getClient();

        try {
            return client.query(query, params);
        } catch(err) {
            if (this.inTransaction) {
                await this.execute('ROLLBACK');
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
        if (!this.inTransaction) {
            this.inTransaction = true;
            await this.execute('BEGIN');
        }
    }

    public async commit() {
        if (this.inTransaction) {
            this.inTransaction = false;
            await this.execute('COMMIT');
        }
    }

    public async rollback() {
        if (this.inTransaction) {
            this.inTransaction = false;
            await this.execute('ROLLBACK');
        }
    }

    public free() {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
    }

    public async countById(config: {
        table: string,
        id:string | number,
    }): Promise<number> {
        const result = await this.select({
            query: `
                SELECT COUNT('id') as count FROM ${config.table}
                WHERE id = $1
            `,
            params: [config.id],
        });
        return parseInt(result[0].count);
    };

    public async isEmpty(config: {
        table: string,
        where?: string,
        pk?: string,
        params?: QueryParams
    }): Promise<boolean> {
        const result = await this.count(config);
        return result === 0;
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
        return parseInt(result[0].count);
    };

    public async sum(config: {
        table: string,
        where?: string,
        pk?: string,
        params?: QueryParams
    }): Promise<number> {
        const result = await this.select({
            query: `
                SELECT SUM(${config.pk ?? 'id'}) as value FROM ${config.table}
                ${config.where ? `WHERE ${config.where}` : ''};
            `,
            params: config.params,
        });
        return parseInt(result[0].value);
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

    public whereById(id: number | string, field?: string) {
        const [where, params] = Where.basicAnd({
            [field ?? `id`]: id,
        });

        return {
            where,
            params,
        }
    }

    public async select(config: {
        query: string,
        params?: QueryParams,
        limit?: number,
        skip?: number,
        orderBy?: string,
        orderByDesc?: boolean,
    }) {
        const result = (await this.execute(`
            ${config.query.replace(';', '')}
            ${!!config.orderBy ? `ORDER BY ${config.orderBy} ${config.orderByDesc ? 'DESC' : ''}` : ''}
            ${!!config.limit ? `LIMIT ${config.limit}`: ''}
            ${!!config.skip ? `OFFSET ${config.skip}` : ''}
        `, config.params)).rows;
        if (this.useCamelConverter) {
            return Converters.keysToCamel(result);
        }
        return result;
    };

    public async insert(config: {
        table: string,
        data: object | object[],
        getID?: boolean,
    }) {
        if (config.data instanceof Array) {
            if (config.data.length === 0) {
                return;
            }
        }

        const [ _fields, _values ] = Polly.getData(
            config.data,
            undefined,
            this.useCamelConverter,
            false,
        );
        const sql = `
            INSERT INTO ${config.table}
                (${_fields.join(',')})
                VALUES ${_values}${config.getID ? ' RETURNING id' : ''};`;
        const result = await this.execute(sql);
        if (config.getID && result?.rows.length === 1) {
            return result?.rows[0].id;
        }
    }

    public async update(config: {
        table: string,
        data: object,
        whereById?: number | string,
        where?: string | null,
        params?: QueryParams,
        allowAtom?: boolean,
    }) {
        if (config.where === undefined && !config.whereById) {
            throw new Error('Envie where ou whereById');
        }

        if (config.whereById) {
            const { where, params } = this.whereById(config.whereById);
            config.where = where;
            config.params = params;
        }

        const [ fields, _data ] = Polly.getData(
            config.data,
            true,
            this.useCamelConverter,
            config.allowAtom ?? false,
        );
    
        const sql = `UPDATE ${config.table}
            SET ${fields.map((f, i) => `${f} = ${_data[i]}`)}
            ${config.where ? `WHERE ${config.where}` : ''};`;
        
        await this.execute(sql, config.params);
    }

    public async delete(config: {
        table: string,
        where?: string | null,
        whereById?: string | number,
        params?: QueryParams,
    }) {
        if (config.where === undefined && !config.whereById) {
            throw new Error('Envie where ou whereById');
        }

        if (config.whereById) {
            const { where, params } = this.whereById(config.whereById);
            config.where = where;
            config.params = params;
        }

        const sql = `DELETE FROM ${config.table}
            ${config.where ? `WHERE ${config.where}` : ''};`;
        
        await this.execute(sql,config.params);
    }

    public static getData(
        data: any,
        asArray: boolean = false,
        useCamelConverter: boolean,
        allowAtom: boolean,
    ) {
        const converter = (o: any) => {
            if (typeof o === 'object') {
                if (Object.prototype.toString.call(o) === '[object Date]') {
                    const tzoffset = o.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(o.valueOf() - tzoffset)).toISOString().slice(0, -1);
                    return localISOTime;
                } 
                return JSON.stringify(o);
            } else if (o === null) {return o};
            return o.toString().replace(/'/g, "''");
        }

        let _fields: any = [];
        const _data: any = [];
        if (!(Object.prototype.toString.call(data) === '[object Array]')) {
            for (let par of Object.keys(data)) {
                if (data[par] !== undefined) {
                    let _formatedField = par;
                    if (useCamelConverter) {
                        _formatedField = Converters.camelToSnakeCase(
                            _formatedField
                        );
                    } else {
                        _formatedField = _formatedField.toLowerCase();
                    }
                    _fields.push(`"${_formatedField}"`);
                    const value = converter(data[par]);

                    if (data[par] === null) {
                        _data.push('null');
                    } else if (allowAtom && (value as string).substring(0, 5) === 'atom(') {
                        _data.push(`"${_formatedField}" ${(value as string).slice(5, value.length - 1)}`);
                    } else {
                        _data.push(`'${value}'`);
                    }
                }
            }
            return [ _fields, asArray ? _data : `(${_data.join(',')})` ];
        }

        for (let item of data) {
            const _value: any[] = [];

            for (let par of Object.keys(item)) {
                if (_fields.length < Object.keys(item).length) {
                    _fields = Object.keys(item).map(a => {
                        let _formatedField = a;
                        if (useCamelConverter) {
                            _formatedField = Converters.camelToSnakeCase(
                                _formatedField
                            );
                        } else {
                            _formatedField = _formatedField.toLowerCase();
                        }
                        return `"${_formatedField}"`;
                    });
                }
                
                let value: any;
                if (item[par] === undefined || item[par] === null) {
                    value = null
                } else {
                    value = converter(item[par]);
                };
                
                if (value === null) {
                    _value.push('null');
                } else {
                    _value.push(`'${value}'`);
                }
            }
            _data.push(`(${_value.join(',')})`);
        }
        return [ _fields, _data ];
    }    
};

export const atomic = (value?: number, op?: '*' | '*') => {
    if (!value || value === 0) {
        return;
    }

    let operation = op ?? '+';
    let completeValue = `${operation} ${value}`;
    if (value < 0 && !op) {
        completeValue = `${value}`;
    } else if (value < 0 && op) {
        completeValue = `${op} (${value})`;
    }

    return `atom(${completeValue})`;
}

export type QueryParams = (string | number | object | boolean)[];
