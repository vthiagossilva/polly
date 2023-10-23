export class Converters {
    public static camelToSnakeCase(str: string) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    };

    public static snackToCamelCase(str: string) {
        return str.replace(/([-_][a-z])/ig, (letter) => {
            return letter.toUpperCase()
                .replace('-', '')
                .replace('_', '');
        });
    }

    public static keysToSnack(o: any) {
        if (isObject(o)) {
            const n = {};

            Object.keys(o)
                .forEach((k) => {
                    n[Converters.camelToSnakeCase(k)] = Converters.keysToSnack(o[k]);
                });

            return n;
        } else if (isArray(o)) {
            return o.map((i) => {
                return Converters.keysToSnack(i);
            });
        }

        return o;
    };

    public static keysToCamel(o: any) {
        if (isObject(o)) {
            const n = {};

            Object.keys(o)
                .forEach((k) => {
                    n[Converters.snackToCamelCase(k)] = Converters.keysToCamel(o[k]);
                });

            return n;
        } else if (isArray(o)) {
            return o.map((i) => {
                return Converters.keysToCamel(i);
            });
        }

        return o;
    };
}

const isArray = function (a) {
    return Array.isArray(a);
};

const isObject = function (o) {
    return o === Object(o) &&
        !isArray(o) &&
        typeof o !== 'function' &&
        !(o instanceof Date);
};