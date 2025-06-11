import { Converters } from './converters';


export class Where {
    public static AND = 'AND';
    public static OR = 'OR';

    public static MORE_THAN = '>';
    public static LESS_THAN = '<';
    public static EQUAL = '=';
    public static ILIKE = 'ILIKE';
    public static LIKE = 'LIKE';

    public static fields(value: string[]): string {
        return value.map(v => (v === '*' || Boolean(v.split(' ').length > 1 || v.split('.').length > 1)) ? v : `"${Converters.camelToSnakeCase(v)}"`).join(', ');
    };

    public static basicAnd(query: {[type: string]: any}): IReturn {
        const _query = Converters.keysToSnack(query);
        let where = '';
        let i = 1;
        const params: any[] = [];
        const keys = Object.keys(_query);

        for (let c of keys) {
            if (_query[c] === undefined) {
                continue;
            }

            let canSplit = c.split(' ').length > 1 || c.split('.').length > 1;

            if (canSplit) {
                where += `${c} = $${i}`;
            } else {
                where += `"${c}" = $${i}`;
            }
            if (i < keys.length) {
                where += ' AND '
            }
            params.push(_query[c]);
            i += 1;
        }

        if (where.slice(-5) === ' AND ') {
            where = where.slice(0, -5);
        }

        return [where, params];
    }

    public static basicAndNotDeleted(query: {[type: string]: any}): IReturn {
        let [ where, params ] = Where.basicAnd(
            query,
        );
        where += ` AND NOT "deleted" IS true `;
        return [where, params];
    }

    public static complex(query: Array<{
        [key: string] : IWhereCommands | JsonTypes | JsonTypes[],
    }>, config?: {
        interOp?: string,
        useParams?: boolean,
        startCounting?: number,
        withoutQuote?: boolean,
    }) {
        let where = '';
        let i = config?.startCounting ?? 1;
        const params: any[] = [];
        query.forEach((_group, gId) => {
            let effectlyPutted = 0;

            if (gId > 0) {
                where += ` ${config?.interOp ?? Where.AND} `;
            }

            where += '(';

            const keys = Object.keys(_group);

            keys.forEach((k, kI) => {
                let group: IWhereCommands = {};

                if (
                    typeof _group[k] === 'object' &&
                    !(_group[k] instanceof Array)
                ) {
                    group = {..._group[k] as IWhereCommands};
                } else {
                    group.value = _group[k] as JsonTypes;
                }

                if (_group[k] === null) {
                    group.value = null;
                }

                if (group.value === undefined) {
                    return;
                }

                if (effectlyPutted > 0) {
                    where += ` ${group.op ?? Where.AND} `;
                }

                if (group.isNot) {
                    where += ' NOT ';
                }

                let canSplit = k.split('->').length >1 || k.split(' ').length > 1 || k.split('.').length > 1;
                const _k = k.includes('->') ? k : Converters.camelToSnakeCase(k);

                if (group.alsoNull) {
                    where +='(';
                }

                if (canSplit) {
                    where += `${_k} `;
                } else {
                    where += `"${_k}" `;
                }

                if (group.value === null) {
                    where += ' IS NULL';
                } else if (group.value instanceof Array) {
                    where += ` IN (${(group.value as Array<JsonTypes>).map(a => `'${a}'`).join(',')})`;
                } else {
                    const bin = group.bin ?? Where.EQUAL;
                    where += bin;
                    if (
                        [Where.MORE_THAN, Where.LESS_THAN].includes(group.bin as string) &&
                        group.allowEqual
                    ) {
                        where += Where.EQUAL;
                    }

                    if (config?.useParams === false) {
                        where += ` ${[Where.ILIKE, Where.LIKE].includes(bin) ?
                            `'%${group.value}%'` :
                            (config.withoutQuote ?
                                group.value :
                                `'${group.value}'`
                            )}`;
                    } else {
                        where += ` $${i}`;
                        params.push(
                            [Where.ILIKE, Where.LIKE].includes(bin) ?
                            `'%${group.value}%'` :
                            group.value
                        );
                    }

                    if (group.alsoNull) {
                        where +=' OR ';
    
                        if (canSplit) {
                            where += `${_k} `;
                        } else {
                            where += `"${_k}" `;
                        }

                        where += ' IS NULL)';
                    }

                    i += 1;
                }
                effectlyPutted += 1;
            });

            where += ')';

            if (effectlyPutted === 0) {
                where = where.slice(0, where.length - (gId > 0 ? 6 : 2));
            }
        });

        return [where, params];
    }
}

export interface IWhereCommands {
    value?: JsonTypes | JsonTypes[],
    op?: string,
    bin?: string,
    allowEqual?: boolean,
    isNot?: boolean,
    alsoNull?: boolean,
};
export type JsonTypes = string | number | boolean | Date | null | object | undefined;
export type IReturn = [string, any[]];