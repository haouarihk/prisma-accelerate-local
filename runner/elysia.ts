import Elysia from 'elysia';
import { PrismaAccelerate, ResultError } from '../src';

// Assuming PrismaAccelerate is properly configured to work with Bun
import forge from 'node-forge';
import { PrismaPg } from '@prisma/adapter-pg';
import { getPrismaClient } from '@prisma/client/runtime/library.js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { download } from '@prisma/fetch-engine';

const createKey = () => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter.setFullYear(now.getFullYear() + 1);

    const attrs = [
        {
            name: 'commonName',
            value: 'example.com',
        },
        {
            name: 'countryName',
            value: 'EXAMPLE',
        },
        {
            shortName: 'ST',
            value: 'Example State',
        },
        {
            name: 'localityName',
            value: 'Example Locality',
        },
        {
            name: 'organizationName',
            value: 'Example Org',
        },
        {
            shortName: 'OU',
            value: 'Example Org Unit',
        },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.sign(keys.privateKey);
    return {
        cert: forge.pki.certificateToPem(cert),
        key: forge.pki.privateKeyToPem(keys.privateKey),
    };
};

const getAdapter = (datasourceUrl: string) => {
    const url = new URL(datasourceUrl);
    const schema = url.searchParams.get('schema');
    const pool = new pg.Pool({
        connectionString: url.toString(),
    });
    return new PrismaPg(pool, {
        schema: schema ?? undefined,
    });
};

const createServer = ({
    datasourceUrl,
    wasm,
    secret,
    singleInstance,
    onRequestSchema,
    onChangeSchema,
}: {
    datasourceUrl?: string;
    wasm?: boolean;
    secret?: string;
    singleInstance?: boolean;
    onRequestSchema?: ({
        engineVersion,
        hash,
        datasourceUrl,
    }: {
        engineVersion: string;
        hash: string;
        datasourceUrl: string;
    }) => Promise<string | undefined | null>;
    onChangeSchema?: ({
        inlineSchema,
        engineVersion,
        hash,
        datasourceUrl,
    }: {
        inlineSchema: string;
        engineVersion: string;
        hash: string;
        datasourceUrl: string;
    }) => Promise<void>;
}) => {
    const prismaAccelerate = new PrismaAccelerate({
        secret,
        datasourceUrl,
        adapter: wasm ? getAdapter : undefined,
        getRuntime: () => require(`@prisma/client/runtime/query_engine_bg.postgresql.js`),
        getPrismaClient,
        singleInstance,
        onRequestSchema,
        onChangeSchema,
        getQueryEngineWasmModule: wasm
            ? async () => {
                const runtimePath =
                    './node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm';
                const queryEngineWasmFilePath = fs.existsSync(runtimePath)
                    ? runtimePath
                    : path.resolve(
                        __dirname,
                        fs.existsSync(path.resolve(__dirname, '../node_modules')) ? '..' : '../..',
                        'node_modules',
                        '@prisma/client/runtime',
                        'query_engine_bg.postgresql.wasm'
                    );
                const queryEngineWasmFileBytes = fs.readFileSync(queryEngineWasmFilePath);
                return new WebAssembly.Module(queryEngineWasmFileBytes);
            }
            : undefined,
        getEnginePath: async (adapter, engineVersion) => {
            const baseDir = adapter ? '@prisma/client/runtime' : '.prisma/client';
            const dirname = path.resolve(
                __dirname,
                fs.existsSync(path.resolve(__dirname, '../node_modules')) ? '..' : '../..',
                'node_modules',
                baseDir,
                adapter ? '' : engineVersion
            );
            if (!adapter) {
                fs.mkdirSync(dirname, { recursive: true });
                const engine = await download({
                    binaries: {
                        'libquery-engine': dirname,
                    },
                    version: engineVersion,
                }).catch(() => undefined);
                if (!engine) {
                    return undefined;
                }
            }

            return dirname;
        },
    });
    const app = new Elysia();

    app
        .get('/ping', () => {
            return "pong"
        })
        .post('/:version/:hash/graphql', async (req) => {
            const txtBody = await req.request.text()

            const { version, hash } = req.params;
            try {
                const result = await prismaAccelerate.query({ hash, headers: req.headers, body: txtBody });
                return result;
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .post('/:version/:hash/transaction/start', async (req) => {
            const txtBody = await req.request.text()

            const { version, hash } = req.params;
            try {
                const result = await prismaAccelerate.startTransaction({ version, hash, headers: req.headers, body: txtBody });
                return result
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .post('/:version/:hash/itx/:id/graphql', async (req) => {
            const txtBody = await req.request.text()

            const { hash, id } = req.params;
            try {
                const result = await prismaAccelerate.queryTransaction({ hash, headers: req.headers, body: txtBody, id });
                return result;
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .post('/:version/:hash/itx/:id/commit', async (req) => {
            const { hash, id } = req.params;
            try {
                const result = await prismaAccelerate.commitTransaction({ hash, headers: req.headers, id });
                return result;
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .post('/:version/:hash/itx/:id/rollback', async (req) => {
            const { hash, id } = req.params;
            try {
                const result = await prismaAccelerate.rollbackTransaction({ hash, headers: req.headers, id });
                return result;
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .put('/:version/:hash/schema', async (req) => {
            const txtBody = await req.request.text()
            const { hash } = req.params;
            try {
                const result = await prismaAccelerate.updateSchema({ hash, headers: req.headers, body: txtBody });
                return result;
            } catch (e) {
                if (e instanceof ResultError) {
                    return req.error(e.code < 200 ? 101 : e.code, e.value)
                }
                throw e;
            }
        })
        .all('*', (req: any, res: any) => {
            return req.error(404, 'Not found')
        });
    return app
}


export function startElysiaServer() {
    createServer({
        datasourceUrl: process.env.DATABASE_URL || "",
        secret: process.env.SECRET || "",
    })
        .listen({
            port: +(process.env.PORT || 4000),
            hostname: process.env.HOST || "0.0.0.0",
            ...createKey()
        }, (server) => console.log(`🚀 Elysia Server is running on ${server.url.href}`))
}