import { getPolly } from ".";
import { Polly } from "./polly";

export class BaseRepository {
    protected polly: Polly;

    constructor(autoRelease: boolean = true) {
        this.polly = getPolly(autoRelease);
    }

    public end() {
        this.polly?.free();
    }
};