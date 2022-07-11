import { getPolly } from "./src";

async function main() {
    // Get your Polly instance
    const polly = getPolly();

    // Now... just use!
    const newID = await polly.insert({
        table: 'my_table',
        data: {
            name: 'Your name',
            age: 15
        },
        getID: true,
    });

    const result = await polly.getOne({
        query: 'SELECT * FROM my_table WHERE id = $1',
        params: [newID],
    });

    console.log(result);

    await polly.delete({
        table: 'my_table',
        where: 'id = $1',
        params: [newID]
    })
}

main();