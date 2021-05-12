-- Tables for testing the driver

DROP TABLE IF EXISTS `person`;
DROP TABLE IF EXISTS `dummy`;

CREATE TABLE `person` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COLLATE utf8_bin,
    `surname` VARCHAR(255) NOT NULL COLLATE utf8_bin,
    `age` INT,
    `has_driver_license` TINYINT(1),
    `preferences` TEXT,
    `birth_date` DATE
);

CREATE TABLE `dummy` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY,
    `value1` BIGINT,
    `value2` DOUBLE,
    `value3` VARCHAR(255),
    `data` TEXT
);

