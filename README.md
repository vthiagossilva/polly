# Polly

### Camada de abstração sobre o PostgreSQL

---

O objetivo deste pacote é facilitar o uso do banco Postegres em cenários _sem ORM_.

Polly gerencia o pool de conexões e abstrai os comandos de escrita (potencialmente mais perigosos), além de facilitar comandos de leitura.

Em breve no NPM. =D

## Criador/mantenedor

 - Thiago Silva

## Licença

 - MIT

## Dependências

Polly depende apenas da biblioteca `pg`  e usa a sintaxe básica do Typescript.

## Modo de uso

O módulo /src/index.ts fornece basicamente toda a estrutura necessária para usar Polly. Você pode utilizar essa classe em qualquer lugar do seu código apenas fazendo:

    const polly = getPolly();

    // Inserir registro
    const newID = await polly.insert({
        table: 'my_table',
        data: {
            name: 'Your name',
            age: 15
        },
        getID: true,
    });

    // Obter um registro
    const result = await polly.getOne({
        query: 'SELECT * FROM my_table WHERE id = $1',
        params: [newID],
    });

    console.log(result);

    // Deletar um registro
    await polly.delete({
        table: 'my_table',
        where: 'id = $1',
        params: [newID]
    })

## Referências da API

### Métodos Principais

    Polly.select({
        query: string,
        params?: QueryParams, // Array com parâmetros
        limit?: number, // LIMIT clause
        skip?: number, // OFFSET clause
        orderBy?: string,
        orderByDesc?: boolean, // DESC if true
    }): Promise<any[]>

    Polly.insert({
        table: string,
        data: object | object[],
        getID?: boolean,
    }): Promise<number | string | undefined>

    Polly.update({
        table: string,
        data: object,
        where: string | null,
        params?: QueryParams,
    }): Promise<void>

    Polly.delete({
        table: string,
        where: string | null,
        params?: QueryParams,
    }): Promise<void>

    Polly.free(): void

### Métodos auxiliares

    Polly.getOne({
        query: string,
        params?: QueryParams,
        orderBy?: string,
        orderByDesc?: boolean,
    }): Promise<object | null>

    Polly.count({
        table: string,
        where?: string,
        pk?: string,
        params?: QueryParams
    }): Promise<number>