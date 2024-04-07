# Flyweight
An ORM for SQLite and NodeJS. Flyweight combines a very simple API for performing basic operations, with the ability to create SQL queries that are parsed by the ORM.

For example, if you create a query in ```./database/sql/users/roles.sql``` that looks like this:

```sql
select
    u.id,
    u.name,
    groupArray(r.name) as roles
from
    users u join 
    roles r on r.userId = u.id
where 
    u.name = $name
group by 
    u.id
```

A function ```db.users.roles``` will be available in the API with the correct types.

![auto-completed code](hero.png)

## Shorthand JSON functions

```sql
object(
    u.id, 
    u.name, 
    u.social) as user
``` 

is just shorthand for 

```sql
json_object(
    'id', u.id, 
    'name', u.name, 
    'social', u.social) as user
```

Other commands available are ```groupArray``` which is shorthand for ```json_group_array```, and ```array```, which is shorthand for ```json_array```.

## Creating tables

Tables are created the same way as they are in SQL. The native types available in strict mode are ```integer```, ```real```, ```text```, ```blob```, and ```any```. In addition to these types, four additional types are included by default: ```boolean```, ```date```, and ```json```. ```boolean``` is a column in which the values are restricted to 1 or 0, ```date``` is a JavaScript ```Date``` stored as an ISO8601 string, and ```json``` is json stored as text. These additional types are automatically parsed by the ORM.

```sql
create table events (
    id integer primary key,
    name text not null,
    startTime date not null,
    locationId integer references locations
);
```

Each table has a singular and plural form. If you want to get one row with the basic API, you can use:

```js
const event = await db.event.get({ id: 100 });
```

If you want to get many rows, you can use:

```js
const names = await db.events.get({ id: eventIds }, 'name');
```

If you want to insert a row, you can do:

```js
const id = await db.coach.insert({
  name: 'Eugene Bareman',
  city: 'Auckland'
});
```

## Getting started

```
mkdir test
cd test
npm init
npx create-flyweight database
```

You can run the ```npx``` command at the root of either an existing or a new project. Once that is done, you can import the database this way:

```js
import { db } from './database/db.js';

await db.user.insert({ name: 'Andrew' });
const users = await db.users.get();
console.log(users);
```

A ```users``` table has already been created for you to play around with.

You can update types whenever you change the SQL by either calling ```npm run watch``` to automatically update the types, or ```npm run types``` to do it manually.

## Migrations

Tables are defined in ```./database/sql/tables.sql```. You can add or change tables from here and then run the migration command ```npm run migrate <migration-name>```.

If you want to add a new column to a table without needing to drop the table, make sure you put the column at the end of the list of columns.

## Regular expressions

Flyweight supports regular expressions in some of its methods. These regular expressions are converted to ```like``` statements, which limits what kind of regular expressions you can make.

```js
const coach = await db.coach.get({ name: /^Eugene.+/ });
```

## Default values

Default values can be set for boolean and date columns using the following syntax:

```sql
create table users (
  id integer primary key,
  isDisabled boolean not null default false,
  createdAt date not null default now()
);
```

```current_timestamp``` will not work properly when wanting to set the default date to the current time. This is because ```current_timestamp``` does not include timezone information and therefore when parsing the date string from the database, JavaScript will assume it is in local time when it is in fact in UTC time.

## The API

Every table has ```get```, ```update```, ```insert```, and ```remove``` methods available to it, along with any of the custom methods that are created when you add a new SQL file to the corresponding table's folder. Views only have the ```get``` method available to them.

### Insert

```insert``` simply takes one argument - ```params```, with the keys and values corresponding to the column names and values you want to insert. It returns the primary key, or part of the primary key if the table has a composite primary key. The plural version of ```insert``` is for batch inserts and takes an array of ```params```. It doesn't return anything.

### Update

```update``` takes two arguments - the ```query``` (or null), and the ```params``` you want to update. It returns a number representing the number of rows that were affected by the query. For example:

```js
await db.coach.update({ id: 100 }, { city: 'Brisbane' });
```

which corresponds to

```sql
update coaches set city = 'Brisbane' where id = 100;
```

### Get

```get``` takes two optional arguments. The first is ```params``` - an object representing the where clause. For example:

```js
const fights = await db.fights.get({ cardId: 9, titleFight: true });
```

translates to

```sql
select * from fights where cardId = 9 and titleFight = 1;
```

The keys to ```params``` must be the column names of the table. The values can either be of the same type as the column, an array of values that are the same type as the column, null, or a regular expression if the column is text. If an array is passed in, an ```in``` clause is used, such as:

```js
const fights = await db.fights.get({ cardId: [1, 2, 3] });
```

which translates to

```sql
select * from fights where cardId in (1, 2, 3);
```

If null is passed in as the value, the SQL will use ```is null```. If a regular expression is passed in, the SQL will use ```like```.

All of the arguments are passed in as parameters for security reasons.

The second argument to ```get``` can be one of three possible values:

1. a string representing a column to select. In this case, the result returned is a single value or array of single values, depending on whether a plural or singular table name is used in the query.
2. an array of strings, representing the columns to select.
3. An object with one or more of the following properties:

```select``` or ```exclude```: ```select``` can be a string or array representing the columns to select. ```exclude``` can be an array of columns to exclude, with all of the other columns being selected.

```orderBy```: a string representing the column to order the result by, or an array of columns to order the result by.

```desc```: set to true when using ```orderBy``` if you want the results in descending order.

```limit``` and ```offset```: corresponding to the SQL keywords with the same name.

```distinct```: adds the ```distinct``` keywords to the start of the select clause.

For example:

```js
const fighters = await db.fighters.get({ isActive: true }, {
  select: ['name', 'hometown'],
  orderBy: 'reachCm',
  limit: 10
});
```

While the default interpretation of the query parameters is ```=```, you can modify the meaning by importing ```not```, ```gt```, ```gte```, ```lt```, and ```lte```.

For example:

```js
import { not } from 'flyweightjs';

const excluded = [1, 2, 3];
const users = await db.users.get({ id: not(excluded) });
```

### Exists and Count

These functions take one argument representing the where clause.

```js
const count = await db.fighters.count({ hometown: 'Brisbane, Australia' });
const exists = await db.fighter.exists({ name: 'Israel Adesanya' });
```

### Remove

```remove``` takes one argument representing the where clause and returns the number of rows affected by the query.

```js
const changes = await db.fighters.remove({ id: 100 });
```

## Creating SQL queries

When creating SQL queries, make sure you give an alias to any columns in the select statement that don't have a name. For exampe, do not do:

```sql
select max(startTime) from events;
```

as there is no name given to ```max(startTime)```.

Parameters in SQL files should use the ```$name``` notation. If you want to include dynamic content, you should use the ```${column}``` format and then pass in a second argument when calling the SQL statement in JavaScript. For example:

```sql
select * from users where location = $location order by ${column};
```

```js
const options = {
  unsafe: {
    column: 'lastName'
  }
};
const users = await db.users.from({ location: 'Brisbane' }, options);
```

If the unsafe parameter is ```undefined``` in the options argument, it will be removed from the SQL statement.

Single quotes in strings should be escaped with ```\```. JSON functions are automatically typed and parsed. For example, the following:

```sql
select id, object(name, startTime) as nest from events;
```

will have the type:

```ts
interface EventQuery {
  id: number;
  nest: { name: string, startTime: Date }
}
```

Nulls are automatically removed from all ```groupArray``` results. When all of the properties of ```object``` are from a left or right join, and there are no matches from that table, instead of returning, for example:

```js
{ name: null, startTime: null }
```

the entire object will be null.

## Transactions and concurrency

Transactions involve taking a connection from a pool of connections by calling ```getTransaction```. Once you have finished using the transaction, you should call ```release``` to return the connection to the pool. If there are a large number of simultaneous transactions, the connection pool will be empty and ```getTransaction``` will start to wait until a connection is returned to the pool.

```js
import { db } from './db.js';

try {
  const tx = await db.getTransaction();
  await tx.begin();

  const coachId = await tx.coach.insert({
    name: 'Eugene Bareman',
    city: 'Auckland'
  });
  const fighterId = await tx.fighter.get({ name: /Israel/ }, 'id');
  await tx.fighterCoach.insert({
    fighterId,
    coachId
  });
  
  await tx.commit();
}
catch (e) {
  console.log(e);
  await tx.rollback();
}
finally {
  db.release(tx);
}
```

## Running tests

To run the tests, first go into the ```test``` folder and run ```node setup.js``` to move the test database to the right location. You can then run the tests with ```node test.js``` or ```npm test```.
