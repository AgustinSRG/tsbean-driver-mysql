// Driver implementation

"use strict";

import MySQL from "mysql2";
import { Readable } from "stream";
import { DataSourceDriver, DataSource, GenericKeyValue, GenericRow, SortDirection, GenericFilter, ExtraFindOptions } from "tsbean-orm";
import { filterToSQL } from "./filtering";
import { normalizeSQLResults, toCamelCase, toSnakeCase, toSQLCompatibleValue } from "./utils";

interface NameConversion {
    parseResults: (r: GenericRow[]) => GenericRow[];
    toSQL: (n: string) => string;
    toBean: (n: string) => string;
}

/**
 * MySQL source configuration
 */
export interface MySQLSourceConfiguration {
    host: string;
    port?: number;
    user?: string;
    password?: string,
    connections?: number;
    database: string;
    debug?: (msg: string) => void;
    disableIdentifierConversion?: boolean;
    customIdentifierConversion?: NameConversion;
}

/**
 * Driver class
 */
export class MySQLDriver implements DataSourceDriver {

    /**
     * Creates a data source for this driver
     * @param config 
     * @returns The data source
     */
    public static createDataSource(config: MySQLSourceConfiguration): DataSource {
        const driver = new MySQLDriver(config);
        return new DataSource("tsbean.driver.mysql", driver);
    }

    public pool: MySQL.Pool;
    public debug: (msg: string) => void;
    public idConversion: NameConversion;

    // private connection: Connection;

    constructor(config: MySQLSourceConfiguration) {
        this.pool = MySQL.createPool({
            /* Single connection for sequential workers, multiple connections for server workers */
            connectionLimit: config.connections || 4,
            host: config.host,
            port: config.port || 3306,
            user: config.user,
            password: config.password,
            database: config.database,
            timezone: '+00:00',
        });
        this.debug = config.debug || function () { };
        if (config.customIdentifierConversion) {
            this.idConversion = config.customIdentifierConversion;
        } else if (config.disableIdentifierConversion) {
            this.idConversion = {
                parseResults: a => a,
                toSQL: a => a,
                toBean: a => a,
            };
        } else {
            this.idConversion = {
                parseResults: normalizeSQLResults,
                toSQL: toSnakeCase,
                toBean: toCamelCase,
            };
        }
    }

    /**
     * Runs a custom SQL query
     * @param sentence The SQL sentence
     * @param values The values to replace
     * @returns The results
     */
    public customQuery(sentence: string, values: any[]): Promise<{ results: any, fields: any[] }> {
        return new Promise<{ results: any, fields: any[] }>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve({ results: results, fields: fields });
            }.bind(this));
        }.bind(this));
    }

    /**
     * Finds a row by primary key
     * @param table Table or collection name
     * @param keyName Name of the key
     * @param keyValue Value of the key
     */
    findByKey(table: string, keyName: string, keyValue: any): Promise<GenericRow> {
        const sentence = "SELECT * FROM `" + table + "` WHERE `" + this.idConversion.toSQL(keyName) + "` = ?";
        const values = [keyValue];
        this.debug("[MYSQL] " + MySQL.format(sentence, values));
        return new Promise<any>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                if (results && results.length > 0) {
                    resolve(this.idConversion.parseResults(results)[0]);
                } else {
                    resolve(null);
                }
            }.bind(this));
        }.bind(this));
    }

    private generateSelectSentence(table: string, filter: GenericFilter, sortBy: string, sortDir: SortDirection, skip: number, limit: number, projection: Set<string>, extraOptions: ExtraFindOptions): { sql: string, values: any[] } {
        let sentence = "SELECT ";
        const values = [];

        if (projection) {
            const toProject = projection.keys();
            const proj = [];

            for (const f of toProject) {
                proj.push("`" + this.idConversion.toSQL(f) + "`");
            }

            sentence += proj.join(", ");
        } else {
            sentence += "*";
        }

        sentence += " FROM `" + table + "`";

        if (extraOptions && extraOptions.useIndex) {
            sentence += " FORCE INDEX (`" + extraOptions.useIndex + "`)";
        }

        const cond1 = filterToSQL(filter, this.idConversion.toSQL);

        if (cond1.query.length > 0) {
            sentence += " WHERE " + cond1.query;
            for (const v of cond1.values) {
                values.push(v);
            }
        }

        if (sortBy) {
            sentence += " ORDER BY `" + this.idConversion.toSQL(sortBy) + "` " + (sortDir === "desc" ? "DESC" : "ASC");
        }

        if (limit !== null && limit >= 0) {
            sentence += " LIMIT " + limit;
        }

        if (skip !== null && skip >= 0) {
            sentence += " OFFSET " + skip;
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return { sql: sentence, values: values };
    }

    /**
     * Finds rows
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param sortBy Sort results by this field. Leave as null for default sorting
     * @param sortDir "asc" or "desc". Leave as null for default sorting
     * @param skip Number of rows to skip. Leave as -1 for no skip
     * @param limit Limit of results. Leave as -1 for no limit
     * @param projection List of fields to featch from the table. Leave as null to fetch them all.
     * @param extraOptions Extra find options
     */
    find(table: string, filter: GenericFilter, sortBy: string, sortDir: SortDirection, skip: number, limit: number, projection: Set<string>, extraOptions?: ExtraFindOptions): Promise<GenericRow[]> {
        const sentenceAndValues = this.generateSelectSentence(table, filter, sortBy, sortDir, skip, limit, projection, extraOptions);
        const sentence = sentenceAndValues.sql;
        const values = sentenceAndValues.values;

        return new Promise<any[]>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                if (results) {
                    resolve(this.idConversion.parseResults(results));
                } else {
                    resolve([]);
                }
            }.bind(this));
        }.bind(this));
    }

    /**
     * Counts the number of rows matching a condition
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param extraOptions Extra find options
     */
    count(table: string, filter: GenericFilter, extraOptions?: ExtraFindOptions): Promise<number> {
        let sentence = "SELECT COUNT(*) AS `count` FROM `" + table + "`";

        if (extraOptions && extraOptions.useIndex) {
            sentence += " FORCE INDEX (`" + extraOptions.useIndex + "`)";
        }

        const values = [];
        const cond1 = filterToSQL(filter, this.idConversion.toSQL);

        if (cond1.query.length > 0) {
            sentence += " WHERE " + cond1.query;
            for (const v of cond1.values) {
                values.push(v);
            }
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<number>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                if (results && results.length > 0) {
                    resolve(results[0].count || 0);
                } else {
                    resolve(0);
                }
            }.bind(this));
        }.bind(this));
    }

    /**
     * Finds rows (stream mode). You can parse each row with an ASYNC function
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param sortBy Sort results by this field. Leave as null for default sorting
     * @param sortDir "asc" or "desc". Leave as null for default sorting
     * @param skip Number of rows to skip. Leave as -1 for no skip
     * @param limit Limit of results. Leave as -1 for no limit
     * @param projection List of fields to featch from the table. Leave as null to fetch them all.
     * @param each Function to parse each row
     * @param extraOptions Extra find options
     */
    findStream(table: string, filter: GenericFilter, sortBy: string, sortDir: SortDirection, skip: number, limit: number, projection: Set<string>, each: (row: GenericRow) => Promise<void>, extraOptions?: ExtraFindOptions): Promise<void> {
        const sentenceAndValues = this.generateSelectSentence(table, filter, sortBy, sortDir, skip, limit, projection, extraOptions);
        const sentence = sentenceAndValues.sql;
        const values = sentenceAndValues.values;

        let busyPromise: Promise<void> = null;

        return new Promise<void>(function (resolve, reject) {
            const stream: Readable = this.pool.query(sentence, values).stream();

            stream.on("error", function (err) {
                this.debug("[MYSQL] [ERROR] " + err.message + "\n" + err.stack)
            }.bind(this));

            stream.on("data", async function (row) {
                stream.pause();

                try {
                    busyPromise = each(this.idConversion.parseResults([row])[0]);
                    await busyPromise;
                } catch (ex) {
                    stream.destroy();
                    reject(ex);
                }

                busyPromise = null;

                stream.resume();
            }.bind(this));

            stream.on("end", async function () {
                if (busyPromise) {
                    try {
                        await busyPromise;
                    } catch (ex) {
                        return reject(ex);
                    }
                }

                resolve();
            }.bind(this));
        }.bind(this));
    }


    /**
     * Finds rows (stream mode). You can parse each row with a SYNC function
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param sortBy Sort results by this field. Leave as null for default sorting
     * @param sortDir "asc" or "desc". Leave as null for default sorting
     * @param skip Number of rows to skip. Leave as -1 for no skip
     * @param limit Limit of results. Leave as -1 for no limit
     * @param projection List of fields to featch from the table. Leave as null to fetch them all.
     * @param each Function to parse each row
     * @param extraOptions Extra find options
     */
    findStreamSync(table: string, filter: GenericFilter, sortBy: string, sortDir: SortDirection, skip: number, limit: number, projection: Set<string>, each: (row: any) => void, extraOptions?: ExtraFindOptions): Promise<void> {
        const sentenceAndValues = this.generateSelectSentence(table, filter, sortBy, sortDir, skip, limit, projection, extraOptions);
        const sentence = sentenceAndValues.sql;
        const values = sentenceAndValues.values;

        return new Promise<void>(function (resolve, reject) {
            const stream: Readable = this.pool.query(sentence, values).stream();

            stream.on("error", function (err) {
                this.debug("[MYSQL] [ERROR] " + err.message + "\n" + err.stack)
            }.bind(this));

            stream.on("data", async function (row) {
                try {
                    each(this.idConversion.parseResults([row])[0]);
                } catch (ex) {
                    stream.destroy();
                    reject(ex);
                }
            }.bind(this));

            stream.on("end", async function () {
                resolve();
            }.bind(this));
        }.bind(this));
    }

    /**
     * Inserts a row
     * @param table Table or collection name
     * @param row Row to insert
     * @param key The name of the primary key (if any)
     * @param callback Callback to set the value of the primary key after inserting (Optional, only if auto-generated key)
     */
    insert(table: string, row: GenericRow, key: string, callback?: (value: GenericKeyValue) => void): Promise<void> {
        let sentence = "INSERT INTO `" + table + "`(";
        const keys = Object.keys(row);
        const sqlKeys = [];
        const values = [];
        const qm = [];
        let insertReturns = false;

        for (const k of keys) {
            if (key === k && (row[k] === null || row[k] === undefined)) {
                continue;
            }
            sqlKeys.push("`" + this.idConversion.toSQL(k) + "`");
            values.push(toSQLCompatibleValue(row[k]));
            qm.push("?");
        }

        sentence += sqlKeys.join(",");

        sentence += ") VALUES (";

        sentence += qm.join(",");

        sentence += ")";

        if (key && (row[key] === null || row[key] === undefined)) {
            // Auto-genrated key
            sentence += " RETURNING `" + this.idConversion.toSQL(key) + "`";
            insertReturns = true;
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<void>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                if (insertReturns) {
                    if (results && results.length > 0) {
                        callback(results[0][this.idConversion.toSQL(key)]);
                    }
                }
                resolve();
            }.bind(this));
        }.bind(this));
    }

    /**
     * Inserts many rows
     * @param table Table or collection name
     * @param rows List of rows to insert
     */
    batchInsert(table: string, rows: GenericRow[]): Promise<void> {
        if (rows.length === 0) {
            return; // Empty set
        }
        const firstRow = rows[0];
        let sentence = "INSERT INTO `" + table + "`(";
        const keys = Object.keys(firstRow);
        const sqlKeys = [];

        for (const key of keys) {
            sqlKeys.push("`" + this.idConversion.toSQL(key) + "`");
        }

        sentence += sqlKeys.join(",");

        sentence += ") VALUES ?";

        const values = rows.map(row => {
            const array = [];
            for (const key of keys) {
                array.push(toSQLCompatibleValue(row[key]));
            }
            return array;
        });

        this.debug("[MYSQL] " + MySQL.format(sentence, [values]));

        return new Promise<void>(function (resolve, reject) {
            this.pool.query(sentence, [values], function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve();
            }.bind(this));
        }.bind(this));
    }

    /**
     * Updates a row
     * @param table Table or collection name
     * @param keyName Name of the key
     * @param keyValue Value of the key
     * @param updated Updated row
     */
    update(table: string, keyName: string, keyValue: GenericKeyValue, updated: GenericRow): Promise<void> {
        const keys = Object.keys(updated);

        if (keys.length === 0) {
            return; // Nothing to update
        }

        let sentence = "UPDATE `" + table + "` SET ";
        const values = [];
        let first = true;

        for (const key of keys) {
            if (first) {
                first = false;
            } else {
                sentence += ", ";
            }

            sentence += "`" + this.idConversion.toSQL(key) + "` = ?";
            values.push(toSQLCompatibleValue(updated[key]));
        }

        sentence += " WHERE `" + this.idConversion.toSQL(keyName) + "` = ?";
        values.push(keyValue);

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<void>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve();
            }.bind(this));
        }.bind(this));
    }

    /**
     * Updates many rows
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param updated Updated row
     * @returns The number of affected rows
     */
    updateMany(table: string, filter: GenericFilter, updated: GenericRow): Promise<number> {
        const keys = Object.keys(updated);

        if (keys.length === 0) {
            return; // Nothing to update
        }

        let sentence = "UPDATE `" + table + "` SET ";
        const values = [];
        let first = true;

        for (const key of keys) {
            if (first) {
                first = false;
            } else {
                sentence += ", ";
            }

            sentence += "`" + this.idConversion.toSQL(key) + "` = ?";
            values.push(toSQLCompatibleValue(updated[key]));
        }

        const cond1 = filterToSQL(filter, this.idConversion.toSQL);

        if (cond1.query.length > 0) {
            sentence += " WHERE " + cond1.query;
            for (const v of cond1.values) {
                values.push(v);
            }
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<number>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve(results.affectedRows);
            }.bind(this));
        }.bind(this));
    }

    /**
     * Deletes a row
     * @param table Table or collection name
     * @param keyName Name of the key
     * @param keyValue Value of the key
     * @returns true if the row was deleted, false if the row didn't exists
     */
    delete(table: string, keyName: string, keyValue: GenericKeyValue): Promise<boolean> {
        const sentence = "DELETE FROM `" + table + "` WHERE `" + this.idConversion.toSQL(keyName) + "` = ?";
        const values = [keyValue];
        this.debug("[MYSQL] " + MySQL.format(sentence, values));
        return new Promise<boolean>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve(results.affectedRows !== 0);
            }.bind(this));
        }.bind(this));
    }

    /**
     * Deletes many rows
     * @param table Table or collection name
     * @param filter Filter to apply
     * @returns The number of affected rows
     */
    deleteMany(table: string, filter: GenericFilter): Promise<number> {
        let sentence = "DELETE FROM `" + table + "`";
        const values = [];

        const cond1 = filterToSQL(filter, this.idConversion.toSQL);

        if (cond1.query.length > 0) {
            sentence += " WHERE " + cond1.query;
            for (const v of cond1.values) {
                values.push(v);
            }
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<number>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve(results.affectedRows);
            }.bind(this));
        }.bind(this));
    }

    /**
     * Summatory of many rows
     * @param table Table or collection name
     * @param filter Filter to apply
     * @param id Name of the primary key
     * @param field Name of the field to aggregate
     */
    sum(table: string, filter: GenericFilter, id: string, field: string): Promise<number> {
        let sentence = "SELECT SUM(`" + this.idConversion.toSQL(field) + "`) AS `" + this.idConversion.toSQL(field) + "` FROM `" + table + "`";
        const values = [];

        const cond1 = filterToSQL(filter, this.idConversion.toSQL);

        if (cond1.query.length > 0) {
            sentence += " WHERE " + cond1.query;
            for (const v of cond1.values) {
                values.push(v);
            }
        }

        this.debug("[MYSQL] " + MySQL.format(sentence, values));

        return new Promise<number>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                const normalized = this.idConversion.parseResults(results);
                if (normalized && normalized.length) {
                    resolve(parseInt(normalized[0][field], 10) || 0);
                } else {
                    resolve(0);
                }
            }.bind(this));
        }.bind(this));
    }

    /**
     * Atomic increment
     * @param table Table or collection name
     * @param keyName The name of the key
     * @param keyValue The value ofthe key
     * @param prop The field to increment
     * @param inc The amount to increment
     */
    increment(table: string, keyName: string, keyValue: GenericKeyValue, prop: string, inc: number): Promise<void> {
        const sentence = "UPDATE `" + table + "` SET `" + this.idConversion.toSQL(prop) + "` = `" + this.idConversion.toSQL(prop) + "` + ? WHERE `" + this.idConversion.toSQL(keyName) + "` = ?";
        const values = [inc, keyValue];
        this.debug("[MYSQL] " + MySQL.format(sentence, values));
        return new Promise<any>(function (resolve, reject) {
            this.pool.query(sentence, values, function (error, results, fields) {
                if (error) {
                    return reject(error);
                }
                resolve();
            }.bind(this));
        }.bind(this));
    }
}
