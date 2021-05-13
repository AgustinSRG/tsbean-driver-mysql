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
