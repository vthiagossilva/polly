import { Pool, types } from 'pg';
import { PoolManager } from './src/manager';
import { Polly } from './src/polly';


types.setTypeParser(1700, function (val) {
    return Number(val);
});

types.setTypeParser(701, function (val) {
    return Number(val);
});


export {
    PoolManager,
    Polly
};