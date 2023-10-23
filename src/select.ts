import { Converters } from './converters';
import { Polly } from "./polly";
import { IWhereCommands, JsonTypes, Where } from './wheres';


class _Select {
    private polly?: Polly;
    private fieldsList: string = '*';
    private fromClause: string;
    private joinsClause?: string;
    private whereClause?: string;
    private limitValue?: number;
    private offsetValue: number;
    private paramsClause?: any[];
    private orderBy?: string;
    private groupBy?: string;
    private isDistinct: boolean;

    constructor(config?: {
        fields?: string[],
        from?: string,
        polly?: Polly,
    }) {
        this.polly = config?.polly;
        config?.from && this.from(config.from);
        this.fields(config?.fields ?? ['*']);
    }

    private convertFields(value: string[]): string {
        return value.map(v => (v === '*' || Boolean(v.split(' ').length > 1 || v.split('.').length > 1)) ? v : `"${Converters.camelToSnakeCase(v)}"`).join(', ');
    };

    public from(table: string, alias?: string): _Select {
        if (!this.fromClause) {
            this.fromClause = '\nFROM ';
        } else {
            this.fromClause += ', ';
        }
        this.fromClause += `${table}${alias ? ` ${alias}` : ''} `;
        return this;
    }

    public fields(fields: string[]): _Select {
        this.fieldsList = this.convertFields(fields);
        return this;
    }

    public join(data: {
        table: string,
        clause?: string,
        predicate: {
            [key: string] : IWhereCommands | JsonTypes | JsonTypes[],
        },
        alias?: string,

    }): _Select {
        const [ predicate, ] = Where.complex([
            data.predicate
        ], {
            useParams: false,
        });
        if (!this.joinsClause) {
            this.joinsClause = '';
        }
        this.joinsClause += '\n';
        this.joinsClause += `
            ${data.clause ?? JOIN.INNER} ${data.table} ${data.alias ?? ''} ON ${predicate}
        `.trim();

        return this;
    }

    public where(query: {
        [key: string]: IWhereCommands | JsonTypes | JsonTypes[]
    }[], config?: {
        interOp?: string,
        useParams?: boolean,
    }) {
        const [ where, params ] = Where.complex(query, {
            interOp: config?.interOp,
            useParams: config?.useParams,
        });

        if (where.length < 3) {return this};

        delete this.whereClause;

        if (!this.whereClause) {
            this.whereClause = '\nWHERE ';
            this.paramsClause = [];
        };

        this.whereClause += where;
        this.paramsClause = [
            ...this.paramsClause as Array<any>,
            ...params,
        ];

        return this;
    }
    
    public limit(limit: number, offset?: number) {
        this.limitValue = limit;
        this.offsetValue = offset ?? this.offsetValue;

        return this;
    }
    
    public offset(offset: number, limit: number) {
        this.offsetValue = offset;
        this.limitValue = limit ?? this.limitValue;

        return this;
    }

    public order(fields: {
        [key: string]: string
    }) {
        if (!this.orderBy) {
            this.orderBy = `\nORDER BY `;
        }

        const fieldsList = Object.keys(fields);
        fieldsList.forEach((f, i) => {
            this.orderBy += `${Converters.camelToSnakeCase(f)} ${fields[f]}`
            if (i !== fieldsList.length - 1) {
                this.orderBy += ', ';
            }
        })

        return this;
    }

    public group(fieldsGrouped: string[]) {
        this.groupBy = `\nGROUP BY ${this.convertFields(fieldsGrouped)}\n`;
        return this;
    }

    public distinct() {
        this.isDistinct = true;
        return this;
    }


    public generate(config?: {
        withBraces?: boolean,
        alias?: string,
    }) {
        let query = `SELECT `;
        this.isDistinct && (query += 'DISTINCT ');
        query += this.fieldsList;
        query += this.fromClause ?? '';
        query += this.joinsClause ?? '';
        query += this.whereClause ?? '';
        query += this.groupBy ?? '';
        query += this.orderBy ?? '';
        this.limitValue && (query += `\nLIMIT ${this.limitValue}`);
        this.offsetValue && (query += `\nOFFSET ${this.offsetValue}`);

        return config?.withBraces ? `\n\t(${query}) ${config.alias ?? ''}` : query;
    }

    public async execute(executor?: Polly) {
        if (!(executor ?? this.polly)) {
            throw new Error(`Provider a Polly executor`);
        }

        const query = this.generate();        

        return (executor ?? this.polly)?.select({
            query,
            params: this.paramsClause,
        });
    }

    public async one(executor?: Polly, reduce?: string) {
        const oldLimit = this.limitValue;
        this.limitValue = 1;
        const r = await this.execute(executor);
        this.limitValue = oldLimit;

        if (reduce) {
            return r[0]?.[reduce] || null;
        }

        return r[0] || null;
    }

    public async count(field: string, executor?: Polly) {
        const oldFields = this.fieldsList;
        this.fieldsList = `COUNT(${Converters.camelToSnakeCase(field)}) total`;
        const r = await this.one(executor);
        this.fieldsList = oldFields;
        return parseInt(r.total);
    }
}

export const JOIN = {
    INNER: 'INNER JOIN',
    LEFT: 'LEFT JOIN',
    RIGHT: 'RIGHT JOIN',
    OUTER: 'OUTER JOIN',
}

export const ORDER = {
    DESC: 'DESC',
    ASC: 'ASC'
}

export const Select = (
    from?: string,
    fields?: string[],
    polly?: Polly,
) => new _Select({
    fields,
    from,
    polly,
});