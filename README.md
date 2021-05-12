# TSBean-ORM MySQL Driver

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
