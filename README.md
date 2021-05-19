# TSBean-ORM MySQL Driver

[![npm version](https://badge.fury.io/js/tsbean-driver-mysql.svg)](https://badge.fury.io/js/tsbean-driver-mysql)
[![Dependency Status](https://david-dm.org/AgustinSRG/tsbean-driver-mysql.svg)](https://david-dm.org/AgustinSRG/tsbean-driver-mysql)
[![devDependency Status](https://david-dm.org/AgustinSRG/tsbean-driver-mysql/dev-status.svg)](https://david-dm.org/AgustinSRG/tsbean-driver-mysql?type=dev)
[![peerDependency Status](https://david-dm.org/AgustinSRG/tsbean-driver-mysql/peer-status.svg)](https://david-dm.org/AgustinSRG/tsbean-driver-mysql?type=peer)

This a MySQL driver for [tsbean-orm](https://github.com/AgustinSRG/tsbean-orm).

Based on [mysql2](https://www.npmjs.com/package/mysql2) package.

## Installation

```
npm install --save tsbean-driver-mysql
```

## Usage

```ts
import { DataSourceDriver, DataSource } from "tsbean-orm";
import { MySQLDriver } from "tsbean-driver-mysql"

const mySource = MySQLDriver.createDataSource({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "my_database"
});

DataSource.set(DataSource.DEFAULT, mySource);
```

## Correspondence of identifiers

This driver from [camel case](https://es.wikipedia.org/wiki/Camel_case) to [snake case](https://en.wikipedia.org/wiki/Snake_case). By default, we expect all the database table and column identifiers in snake case. Those identifiers will be converted to camel case before passing to tsbean, so you can work with camel case identifiers in your code.

Here is an example:

```sql
CREATE TABLE `person` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COLLATE utf8_bin,
    `surname` VARCHAR(255) NOT NULL COLLATE utf8_bin,
    `age` INT,
    `has_driver_license` TINYINT(1),
    `preferences` TEXT,
    `birth_date` DATE
);
```

```ts
const SOURCE = DataSource.DEFAULT;
const TABLE = "person";
const PRIMARY_KEY = "id";

export class Person extends DataModel {

    public static finder = new DataFinder<Person>(
        SOURCE, // The data source
        TABLE, // The table or collection name
        PRIMARY_KEY, // The primary key. Leave blank if no primary key
        (data: GenericRow) => {
            return new Person(data);
        },
    );

    public id: number;
    public name: string;
    public surname: string;
    public age: number;
    public hasDriverLicense: boolean;
    public preferences: string[];
    public birthDate: Date;

    constructor(data: GenericRow) {
        // First, we call DataModel constructor 
        super(
            SOURCE, // The data source
            TABLE, // The table or collection name
            PRIMARY_KEY // The primary key. Leave blank if no primary key
        );

        // Second, we set the class properties
        // The recommended way is to set one by one to prevent prototype pollution
        // You can also enforce the types if you do not trust the data source
        // In that case you can use the enforceType utility function

        this.id = enforceType(data.id, "int");
        this.name = enforceType(data.name, "string");
        this.surname = enforceType(data.surname, "string");
        this.age = enforceType(data.age, "int");
        this.hasDriverLicense = enforceType(data.hasDriverLicense, "boolean");
        this.preferences = enforceType(data.preferences, "array");
        this.birthDate = enforceType(data.birthDate, "date");

        // Finally, we must call init()
        this.init();
    }
}
```

If you want to disable this behaviour, and instead use identifiers as-it, you can use the `disableIdentifierConversion` option of the data source constructor:

```ts
const mySource = MySQLDriver.createDataSource({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "my_database",
    disableIdentifierConversion: true
});
```

You can also set `customIdentifierConversion` to implement your own identifier conversion.
