import { homedir } from 'os';
import { resolve } from 'path';
import { stat, access, readFile, writeFile, constants } from 'fs';
import { promisify } from 'util';
import * as assert from 'assert';

const DEFAULT_BASE = homedir();

export interface StorageInterfaceItem {
    primary?: boolean;
}

export interface StorageInstance {
    [key: string]: any;
}

export type StorageType = 'json';

export interface StorageOptions {
    name: string;
    filename?: string;
    base?: string;
    type?: StorageType;
}

export interface FindOptions {
    where?: any;
    limit?: number;
}

export default class Storage<TInstance extends StorageInstance, TOptions extends StorageOptions> {
    static define<TInstance extends StorageInstance, TOptions extends StorageOptions>(defination: TInstance, options?: TOptions): Storage<TInstance, TOptions> {
        return new Storage(defination, <any>options);
    }

    static default = Storage;

    // @ts-ignore
    private readonly name: string;
    private readonly file: string;
    private readyStat: Promise<any> | Boolean;

    constructor(options: TOptions)
    constructor(defination: TInstance, options: TOptions)
    constructor(defination: TInstance, options?: TOptions) {
        if (!options && !!defination) {
            options = <any>defination;
            defination = <any>{};
        }

        const {name, base, filename} = <TOptions>options;

        assert(typeof name === 'string' && name !== '', `name must be non-empty string, but got ${typeof name}`);

        this.name = name;

        assert(base || filename, 'base or filename cannot be both undefined, or it may overwrite other files');

        this.file = resolve(base || DEFAULT_BASE, filename || name);

        this.readyStat = this.init();
    }

    /**
     * check file access
     */
    private async init(): Promise<Boolean> {
        try {
            const state = await promisify(stat)(this.file);
            const accessible = await promisify(access)(this.file, constants.R_OK | constants.W_OK).then(() => true, () => false);
            assert(state.isFile() && accessible, 'target file must be a file and have access to read or write');
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
            await promisify(writeFile)(this.file, '[]', 'utf8');
        }

        this.readyStat = true;

        return true;
    }

    async ready() {
        return this.readyStat;
    }

    private async read(): Promise<any[]> {
        await this.ready();
        this.readyStat = promisify(readFile)(this.file, 'utf8').then((res) => {
            this.readyStat = true;
            return JSON.parse(res);
        });
        return this.readyStat;
    }

    private async write(data) {
        await this.ready();
        this.readyStat = promisify(writeFile)(this.file, JSON.stringify(data), 'utf8').then(() => {
            this.readyStat = true;
        });
        return this.readyStat;
    }

    async create(data: any) {
        const dataset = await this.read();
        dataset.push(data);
        await this.write(dataset);
    }

    private match(data, keys, query: any): boolean {
        return keys.every((key) => data[key] === query[key]);
    }

    async find({where, limit}: FindOptions = {}): Promise<undefined | any[]> {
        const dataset = await this.read();

        const list: any[] = [];

        const keys = Object.keys(where);

        for (const item of dataset) {
            if (this.match(item, keys, where)) {
                if (limit === 1) {
                    return item;
                }
                list.push(item);
            }
        }
        return limit === 1 ? undefined : list;
    }

    async fineOne(findOptions: FindOptions = {}): Promise<any> {
        return this.find({...findOptions, limit: 1});
    }

    async update(data: any, {where, limit}: FindOptions = {}) {
        const dataset = await this.read();

        let updated: number = 0;

        const keys = Object.keys(where);

        for (const index in dataset) {
            const item = dataset[index];
            if (this.match(item, keys, where)) {
                dataset[index] = data;
                updated++;
                if (limit === 1) {
                    break;
                }
            }
        }

        if (updated > 0) {
            await this.write(dataset);
        }

        return updated;
    }

    async destroy({where, limit}: FindOptions = {}) {
        const dataset = await this.read();

        const destroyed: any[] = [];


        const keys = Object.keys(where);

        for (const index in dataset) {
            const item = dataset[index];
            if (this.match(item, keys, where)) {
                delete dataset[index];
                destroyed.push(index);
                if (limit === 1) {
                    break;
                }
            }
        }

        const length = destroyed.length;

        if (length > 0) {
            await this.write(dataset.filter((_, i) => !destroyed.includes(String(i))));
        }

        return length;
    }
}
