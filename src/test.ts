import { Select } from "./select";

async function main() {
    const mySelect =  Select('clients c', ['email', 'phone', 'id'])
            .where([
                {
                    't.id': null,
                }
            ])
            .limit(200)
            .generate();
    console.log(mySelect);
}

main();