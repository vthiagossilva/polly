import { PoolManager } from "./manager";
import { Polly } from "./polly";


async function main() {
    const pool = new PoolManager({
        logQueries: false,
     });
     const polly = new Polly({
        pool,
        dryRun: true,
     });
     await polly.startTransaction();
     await polly.update({
        data: {
            fake: 'data'
        },
        table: 'no-table',
        params: [1],
        where: 'noop = $1'
     });
     await polly.insert({
        data: {
            fake: 'data'
        },
        table: 'no-table',
        getID: true,
     });
     await polly.commit();

     console.log(polly.getLogs());

}

main();