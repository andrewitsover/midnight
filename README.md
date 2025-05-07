# Flyweight
Flyweight is a NodeJS and edge ORM with first-class support for databases that are compatible with SQLite, including Cloudflare D1 and Turso.

Features include a comprehensive API, the ability to automatically type and query inside JSON, and advanced typing of raw SQL queries so that you are not without TypeScript support in any situation.

## Creating tables

Tables are created the same way as they are in SQL. The native types available in strict mode are ```integer```, ```real```, ```text```, ```blob```, and ```any```. In addition to these types, four additional types are included by default: ```boolean```, ```date```, and ```json```. ```boolean``` is a column in which the values are restricted to 1 or 0, ```date``` is a JavaScript ```Date``` stored as an ISO8601 string, and ```json``` is ```jsonb``` stored as a blob if the database supports it, otherwise it is text. These additional types are automatically parsed by the ORM.

```sql
create table events (
    id integer primary key,
    name text not null,
    startTime date not null,
    locationId integer references locations
);
```

If you want to get one row with the basic API, you can use:

```js
const event = await db.events.get({ id: 100 });
```

If you want to get many rows, you can use:

```js
const names = await db.events.many({ id: eventIds }, 'name');
```

If you want to insert a row, you can do:

```js
const id = await db.coaches.insert({
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

await db.users.insert({ name: 'Andrew' });
const users = await db.users.many();
console.log(users);
```

A ```users``` table has already been created for you to play around with.

You can update types whenever you change the SQL by either calling ```npm run watch``` to automatically update the types, or ```npm run types``` to do it manually.

## Migrations

Tables are defined in ```./database/sql/tables.sql```. You can add or change tables from here and then run the migration command ```npm run migrate <migration-name>```.

If you want to reset the migration system to a new database that already has tables created on it, edit the ```tables.sql``` file and then run ```npm run reset```.

If you want to add a new column to a table without needing to drop the table, make sure you put the column at the end of the list of columns.

## JSON support

Flyweight can sample columns that are declared with the ```json``` by querying the database. From these samples, types will be automatically created for both the return type of queries and for creating queries themselves.

To sample your local database, run ```npm run sample```.

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

Every table has ```get```, ```many```, ```query```, ```update```, ```upsert```, ```insert```, ```insertMany```, and ```remove``` methods available to it, along with any of the custom methods that are created when you add a new SQL file to the corresponding table's folder. Views only have the ```get```, ```many```, and ```query``` methods available to them.

### Insert

```insert``` simply takes one argument - ```params```, with the keys and values corresponding to the column names and values you want to insert. It returns the primary key, or part of the primary key if the table has a composite primary key. For batch inserts you can use ```insertMany``` and it takes an array of ```params```. It doesn't return anything.

### Update

```update``` takes an object with an optional ```where``` property, and a ```set``` property. It returns a number representing the number of rows that were affected by the query. For example:

```js
await db.coaches.update({
  where: { id: 100 }, 
  set: { city: 'Brisbane' }
});
```

which corresponds to

```sql
update coaches set city = 'Brisbane' where id = 100;
```

### Upsert

```upsert``` will update the row if the target's uniqueness contraint is violated by the insert. If ```target``` or ```set``` are not provided, the upsert will do nothing when there is a conflict. ```upsert``` returns the primary key of the inserted or updated row.

```js
const id = await db.coaches.upsert({
  values: {
    id: 1,
    name: 'Test User',
    city: 'Test City'
  },
  target: 'id',
  set: {
    city: 'Updated City'
  }
});
```

### Get and Many

```get``` and ```many``` take two optional arguments. The first is ```params``` - an object representing the where clause. For example:

```js
const fights = await db.fights.many({ cardId: 9, titleFight: true });
```

translates to

```sql
select * from fights where cardId = 9 and titleFight = 1;
```

The keys to ```params``` must be the column names of the table. The values can either be of the same type as the column, an array of values that are the same type as the column or null. If an array is passed in, an ```in``` clause is used, such as:

```js
const fights = await db.fights.many({ cardId: [1, 2, 3] });
```

which translates to

```sql
select * from fights where cardId in (1, 2, 3);
```

If null is passed in as the value, the SQL will use ```is null```.

All of the arguments are passed in as parameters for security reasons.

The second argument to ```get``` or ```many``` selects which columns to return. It can be one of the following:

1. a string representing a column to select. In this case, the result returned is a single value or array of single values, depending on whether ```get``` or ```many``` is used.

```js
const born = await db.fighters.get({ id: 3 }, 'born');
```

2. a lambda function that traverses a JSON object.

```js
const instagram = await db.fighters.get({ id: 3 }, c => c.social.instagram);
```

In this case, ```social``` is a JSON object with an ```instagram``` property.

3. an array of strings, representing the columns to select.

```js
const fighter = await db.fighters.get({ id: 3 }, ['id', 'born']);
```

### Query and First

You can use the ```query``` or ```first``` syntax for more complex queries. ```query``` returns an array in the same way as ```many```, and ```first``` returns an object or ```undefined``` if nothing is found. The additional keywords are:

```select```: a string or array of strings representing the columns to select.

```omit```: a string or array of strings representing the columns to omit. All of the other columns will be selected.

```include```: include other tables in the result.

```alias```: create an alias for columns, such as when selecting inside of JSON objects.

```orderBy```: a string representing the column to order the result by, or an array of columns to order the result by.

```desc```: set to true when using ```orderBy``` if you want the results in descending order.

```limit``` and ```offset```: corresponding to the SQL keywords with the same name.

```distinct```: adds the ```distinct``` keywords to the start of the select clause.

```debug```: when set to true, the result will include debug information such as the raw SQL used in the query.

For example:

```js
const fighters = await db.fighters.query({
  where: { 
    isActive: true 
  }, 
  select: ['name', 'hometown'],
  orderBy: 'reachCm',
  limit: 10
});
```

You can select inside JSON objects and create an alias for the result:

```js
const orderBy = await db.fighters.query({
  where: {
    id: n => n.lt(10)
  },
  select: ['id', 'born'],
  alias: {
    instagram: s => s.social.instagram
  },
  orderBy: 'instagram'
});
```

You can also include additional relations:

```js
const locations = await db.locations.query({
  include: {
    events: (t, c) => t.events.many({ locationId: c.id })
  }
});
```

If you want to predefine the join clause for two tables, you can call ```define```. This should be done in the ```db.js``` file before exporting.

```js
db.locations.define((t, c) => t.events.where({
  locationId: c.id
}));
```

Now you no longer have to specify the join in queries.

```js
const defined = await db.locations.query({
  include: {
    events: t => t.events.query({
      limit: 3,
      orderBy: 'startTime',
      desc: true
    })
  },
  limit: 3
});
```

While the default interpretation of the query parameters is ```=```, you can pass in a function to use ```not```, ```gt```, ```gte```, ```lt```, ```lte```, ```like```, ```range```, ```match``` and ```glob```.

For example:

```js
const excluded = [1, 2, 3];
const users = await db.users.many({ id: i => i.not(excluded) });
const count = await db.users.count({
  where: {
    id: i => i.range({ gt: 10, lt: 15 })
  }
});
```

### Complex filtering

If you need to perform complex logic in the ```where``` clause, you can use the ```and``` or ```or``` properties. For example:

```js
const events = await db.events.query({
  where: {
    or: [
      { name: n => n.like('UFC 1_: The%') },
      { id: n => n.lt(10) },
      {
        and: [
          { startTime: n => n.gt(time) },
          { name: n => n.like('%Japan%') }
        ]
      }
    ]
  }
});
```

You should only include one condition per object.

### Aggregate functions

There are multiple functions that aggregate the results into a single value. These include ```count```, ```avg```, ```min```, ```max```, and ```sum```. Despite its name, ```sum``` uses the SQLite function ```total``` to determine the results.

All of these functions take three arguments:

```where```: the where clause

```column```: the column to aggregate. This is optional for ```count```.

```distinct```: the same as ```column``` but it adds ```distinct``` to the front.

```js
const count = await db.fighters.count({
  where: {
    hometown: 'Brisbane, Australia'
  }
});
```

There is also an ```exists``` function that takes one argument representing the where clause.

```js
const exists = await db.fighters.exists({ name: 'Israel Adesanya' });
```

### Group

You can write ```group by``` statements like this:

```js
const heights = await db.fighters.group({
  by: 'hometown',
  alias: {
    height: agg => agg.avg({ column: 'heightCm' }),
    sample: agg => agg.count()
  },
  where: {
    sample: s => s.gt(1)
  },
  orderBy: 'height',
  desc: true,
  limit: 5
});
```

### Remove

```remove``` takes one argument representing the where clause and returns the number of rows affected by the query.

```js
const changes = await db.fighters.remove({ id: 100 });
```

## Creating SQL queries

When the API doesn't do what you need it to do, you can create SQL queries. You can do this by creating a folder with the same name as the table, such as ```./database/sql/users```. You can then put SQL files in this folder that will be available in the API.

For example, if you create a query in ```./database/sql/users/roles.sql``` that looks like this:

```sql
select
    u.id,
    u.name,
    groupArray(r.name) as roles
from
    users u join
    userRoles ur on ur.userId = u.id join
    roles r on ur.roleId = r.id
where 
    u.name = $name
group by 
    u.id
```

A function ```db.users.roles``` will be available in the API with the correct types.

![auto-completed code](hero.png)

When creating SQL queries, make sure you give an alias to any columns in the select statement that don't have a name. For example, do not do:

```sql
select max(startTime) from events;
```

as there is no name given to ```max(startTime)```.

Parameters in SQL files should use the ```$name``` notation. If you want to include dynamic content that cannot be parameterized, you should use the ```${column}``` format and then pass in a second argument when calling the SQL statement in JavaScript. For example:

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

## Alias stars

Normally, SQLite doesn't support aliased stars, but this syntax is now available when writing SQL statements with Flyweight.

```sql
select
    e.*,
    l.name as locationName
from 
    events e join
    locations l on e.locationId = l.id
```

## Transactions

Transactions involve locking writes to the database with ```getTransaction```. If multiple transactions try to run at the same time, they will wait until the current transaction is complete.

```js
import { db } from './db.js';

try {
  const tx = await db.getTransaction();
  await tx.begin();

  const coachId = await tx.coaches.insert({
    name: 'Eugene Bareman',
    city: 'Auckland'
  });
  const fighterId = await tx.fighters.get({ name: n => n.like('Israel%') }, 'id');
  await tx.fighterCoaches.insert({
    fighterId,
    coachId
  });
  
  await tx.commit();
}
catch (e) {
  console.log(e);
  await tx.rollback();
}
```

## Batches

You can also run multiple statements inside a single transaction without any logic using ```batch```. This is supported by all databases. Here is an example using D1.

```ts
import createClient from './database/db';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const db = createClient(env.DB);

    const projectId = 1;
    const [project, tags, issues] = await db.batch((bx) => [
      bx.projects.get({ id: projectId }),
      bx.tags.many({ projectId }),
      bx.issues.many({ projectId })
    ]);

    return Response.json({
      ...project
      tags,
      issues
    });
  }
};
```

## Views

Views are treated like read-only tables. They have a ```get``` and ```many``` method available to them that works the same as with tables. If you want to create a view called ```activeUsers``` you can add a file in the ```views``` folder called ```./database/views/activeUsers.sql``` that might have SQL like this:

```sql
create view activeUsers as
select * from users where isActive = true;
```

You can now use it in the API like this:

```js
import { db } from './database/db.js';

const user = await db.activeUsers.get({ id: 100 }, ['name', 'email']);
console.log(user.email);
```

## Cloudflare D1

Flyweight provides first-class support for D1. The only difference between the D1 API and the SQLite API is that D1 doesn't support transactions other than ```batch```.

To get started, run this command in the root of your Cloudflare Workers project.

```
npx create-flyweight d1 src/database
```

The first thing you will want to do is go into ```src/database/config.js``` and set the database name. If you want to use JSON sampling, you should also set the ```localPath``` to the path of the local SQLite file, which is usually somewhere in the ```.wrangler``` folder.

If your database already has tables created on it, go into ```src/database/sql/tables.sql``` and add all of the ```create``` statements and then run:

```
npm run reset
```

to reset the migration system to the current state of the database. All migration commands work on the local version of the database and interface with the wrangler migration system so that you can run ```apply``` on the remote database yourself to add any migrations.

If you have more than one database and want to create a migration for a specific database, you can run:

```
npm run migrate dbName migrationName
```

You should run ```npm run watch``` to keep the ```src/database/files.js``` updated with any new sql files or table changes while you write the code.

## Turso

Turso uses ```npm run watch``` to keep the same file D1 uses updated so that the database can run in edge-based environments where necessary. Turso also supports the same transaction API that the standard SQLite database uses. The only difference is that the ```getTransaction``` function for Turso needs a type of either ```read``` or ```write```.

In the root directory of the project, you can install flyweight with

```
npx create-flyweight turso database
```

You will then need to edit the file in ```database/db.js``` to change the ```url``` and any other arguments you need. You will also want to change the import statement for turso to use the web version of the client if you are running in a edge-based environment.

You can then use it like this:

```ts
import createClient from './database/db';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const db = createClient();
    const users = await db.users.many();

    return Response.json(users);
  }
};
```
