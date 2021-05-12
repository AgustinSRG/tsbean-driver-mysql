# TSBean-ORM Driver Template

This is a generic template to create a driver for [tsbean-orm](https://github.com/AgustinSRG/tsbean-orm).

Modify `driver.ts` to implement the driver functionalities depending on the data source this driver supports.

## Installation

```
npm install --save [driver-name-here]
```

## Build the project

To compile the driver type:

```
npm run build
```

The javascript files are stored in the `dist` folder.

The documentation is stored in the `docs` folder.

## Usage

```ts
import { DataSourceDriver, DataSource } from "tsbean-orm";
import { TemplateDriver } from "tsbean-driver-template"

const mySource = TemplateDriver.createDataSource({} /* Options */);

DataSource.set(DataSource.DEFAULT, mySource);
```
