# 🌒 Midnight
```
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠁⠸⢳⡄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠀⠀⢸⠸⠀⡠⣄⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠃⠀⠀⢠⣞⣀⡿⠀⠀⣧⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⡖⠁⠀⠀⠀⢸⠈⢈⡇⠀⢀⡏⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⡴⠩⢠⡴⠀⠀⠀⠀⠀⠈⡶⠉⠀⠀⡸⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⠎⢠⣇⠏⠀⠀⠀⠀⠀⠀⠀⠁⠀⢀⠄⡇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢠⠏⠀⢸⣿⣴⠀⠀⠀⠀⠀⠀⣆⣀⢾⢟⠴⡇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣿⠀⠠⣄⠸⢹⣦⠀⠀⡄⠀⠀⢋⡟⠀⠀⠁⣇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⡾⠁⢠⠀⣿⠃⠘⢹⣦⢠⣼⠀⠀⠉⠀⠀⠀⠀⢸⡀⠀⠀⠀⠀
⠀⠀⢀⣴⠫⠤⣶⣿⢀⡏⠀⠀⠘⢸⡟⠋⠀⠀⠀⠀⠀⠀⠀⠀⢳⠀⠀⠀⠀
⠐⠿⢿⣿⣤⣴⣿⣣⢾⡄⠀⠀⠀⠀⠳⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢣⠀⠀⠀
⠀⠀⠀⣨⣟⡍⠉⠚⠹⣇⡄⠀⠀⠀⠀⠀⠀⠀⠀⠈⢦⠀⠀⢀⡀⣾⡇⠀⠀
⠀⠀⢠⠟⣹⣧⠃⠀⠀⢿⢻⡀⢄⠀⠀⠀⠀⠐⣦⡀⣸⣆⠀⣾⣧⣯⢻⠀⠀
⠀⠀⠘⣰⣿⣿⡄⡆⠀⠀⠀⠳⣼⢦⡘⣄⠀⠀⡟⡷⠃⠘⢶⣿⡎⠻⣆⠀⠀
⠀⠀⠀⡟⡿⢿⡿⠀⠀⠀⠀⠀⠙⠀⠻⢯⢷⣼⠁⠁⠀⠀⠀⠙⢿⡄⡈⢆⠀
⠀⠀⠀⠀⡇⣿⡅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠦⠀⠀⠀⠀⠀⠀⡇⢹⢿⡀
⠀⠀⠀⠀⠁⠛⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠼⠇⠁
```
The time after the 11th hour. Midnight is a NodeJS ORM for SQLite with full TypeScript support without needing to generate any code. Even complex SQL queries can be written inside of JavaScript.

Tables are written in JavaScript like this:

```js
class Forests extends Table {
  name = text;
  address = text;

  displayName = () => concat(this.name, ' - ', this.address);
}

class Trees extends Table {
  name = text;
  planted = index(plainDate);
  forestId = cascade(Forests);
  alive = init(true);
}
```

There are two levels of API. The first is a table-level syntax for basic queries.

```js
const tree = db.trees.get({ 
  id: 1,
  alive: true
});
```

The second type of syntax is much like SQL and builds on many of the new features that JavaScript has added to its language in recent times.

```js
const trees = db.query(c => {
  const { forests: f, trees: t } = c;
  return {
    select: {
      ...t,
      forest: f.name
    },
    where: {
      [t.id]: [1, 2, 3]
    }
  }
});
```

This syntax allows you to perform queries that usually aren't possible in ORMs.

## Getting started

### Prerequists

Make sure you have installed [Node.js](https://nodejs.org/en) version 26.1.0 or higher.

### Creating a project

Create a directory for your project and initialise it with npm:

```
mkdir forests
cd forests
npm init -y
npm install @andrewitsover/midnight
touch main.js
```

In the package.json, change the following lines:

```json
{
  "main": "main.js",
  "type": "module"
}
```

Paste the code below into the ```main.js``` file.

This example will create a ```clouds``` table in a database named ```forest.db``` and then insert and read some rows.

```js
import { Database, Table, text } from '@andrewitsover/midnight';

const database = new Database('forest.db');

class Clouds extends Table {
  name = text;
};

const db = database.getClient({ Clouds });
const sql = db.diff();
db.migrate(sql);

db.clouds.insert({ name: 'Nimbus' });
const clouds = db.clouds.many();
console.log(clouds);
```

For ```Temporal``` support in a JavaScript project, add a ```jsconfig.json``` file in the root folder of the project with the following options:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "checkJs": false
  }
}
```

To run it, you can use ```node main.js``` from the project root directory.

It is a good idea to set any SQLite database that you have created to ```pragma journal_mode=WAL```. You can do this yourself after the database has been created. See [here](https://sqlite.org/wal.html) for more details.

## The API

Every table has ```get```, ```many```, ```first```, ```query```, ```update```, ```upsert```, ```insert```, ```insertMany```, ```returnInsert```, ```returnInsertMany```, ```returnUpsert```, and ```delete``` methods available to it.

### Insert

```insert``` inserts a row into the database. For batch inserts you can use ```insertMany```, which takes an array of objects. ```returnInsert``` and ```returnInsertMany``` return all of the inserted objects.

```js
const id = db.moons.insert({
  name: 'Europa',
  orbit: 'Retrograde'
});
```

### Update

```update``` takes an object with an optional ```where``` property, and a ```set``` property. It returns a number representing the number of rows that were affected by the query. For example:

```js
db.moons.update({
  where: { id: 100 }, 
  set: { orbit: 'Prograde' }
});
```

If you want to update columns based on their existing value, you can pass a function into the ```set``` properties like this:

```js
db.moons.update({
  set: {
    orbit: (c, f) => f.concat(c.orbit, ' - Circular')
  },
  where: {
    id: 3
  }
});
```

All of the built-in SQLite functions are available, in addition to the mathematical operators ```plus```, ```minus```, ```divide```, and ```multiply```.

### Upsert

```upsert``` will update the row if the target's uniqueness contraint is violated by the insert. If ```target``` or ```set``` are not provided, the upsert will do nothing when there is a conflict. ```upsert``` returns the primary key of the inserted or updated row. ```returnUpsert``` returns the entire row.

```js
const id = db.forests.upsert({
  values: {
    id: 1,
    name: 'Daisy Hill Forest',
    address: 'Brisbane'
  },
  target: 'id',
  set: {
    address: 'Brisbane'
  }
});
```

### Get and Many

```get``` and ```many``` take two optional arguments. The first argument represents the where clause. For example:

```js
const trees = db.trees.many({ 
  forestId: 9,
  alive: true
});
```

If an array is passed in, an ```in``` clause is used, such as:

```js
const trees = db.trees.many({
  forestId: [1, 2, 3]
});
```

If null is passed in as the value, the SQL will use ```is null```.

The second argument to ```get``` or ```many``` selects which columns to return. It can be one of the following:

1. a string representing a column to select. In this case, the result returned is a single value or array of single values, depending on whether ```get``` or ```many``` is used.

```js
const planted = db.trees.get({ id: 3 }, 'planted');
```

2. an array of strings, representing the columns to select.

```js
const tree = db.trees.get({ id: 3 }, ['id', 'born']);
```

### Query and First

You can use the ```query``` or ```first``` syntax for more complex queries. ```query``` returns an array in the same way as ```many```, and ```first``` returns an object or ```undefined``` if nothing is found. The additional keywords are:

```select```: an array of strings representing the columns to select.

```return```: a string representing the column to select.

```omit```: a string or array of strings representing the columns to omit. All of the other columns will be selected.

```js
const rangers = db.rangers.query({
  omit: 'password',
  where: {
    id: [1, 2, 3]
  }
});
```

```orderBy```: a string or an array representing the column or columns to order the result by. This can also be a function that utilises the built-in SQLite functions.

```js
const trees = db.trees.query({
  where: {
    category: 'Evergreen'
  },
  orderBy: c => lower(c.name)
});
```

```desc```: set to true when using ```orderBy``` if you want the results in descending order.

```limit``` and ```offset```: corresponding to the SQL keywords with the same name.

```distinct```: adds the ```distinct``` keywords to the start of the select clause.

For example:

```js
const trees = db.trees.query({
  where: { 
    alive: true 
  }, 
  select: ['name', 'category'],
  orderBy: 'id',
  limit: 10
});
```

While the default interpretation of the query parameters is ```=```, you can pass in a function to use ```not```, ```gt```, ```gte```, ```lt```, ```lte```, ```like```, ```match``` or ```glob```.

For example:

```js
const excluded = [1, 2, 3];
const moons = db.moons.many({ id: not(excluded) });
const count = db.moons.count({
  where: {
    id: gt(10)
  }
});
```

### Complex filtering

If you need to perform complex logic in the ```where``` clause, you can use the ```and``` or ```or``` properties. For example:

```js
const wolves = db.animals.query({
  where: {
    or: [
      { name: like('Gray%') },
      { id: lt(10) },
      {
        and: [
          { tagged: gt(time) },
          { name: like('Red%') }
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

```distinct```: the same as ```column``` but it aggregates by distinct values.

```js
const count = db.trees.count({
  where: {
    native: true
  }
});
```

There is also an ```exists``` function that takes one argument representing the where clause.

```js
const exists = db.moons.exists({ 
  name: 'Cumulus'
});
```

### Delete

```delete``` takes one argument representing the where clause and returns the number of rows affected by the query.

```js
const changes = db.moons.delete({ id: 100 });
```

## Transactions

Transactions allow all operations to succeed or fail together so that the database is not left in an incorrect state. Make sure you do not ```await``` on any functions while performing a transaction as this will allow other operations outside of the transaction to run and therefore be included in the transaction unintentionally. In other words, there should be no ```await``` statement between the ```begin``` and ```commit``` functions.

```js
try {
  db.begin();
  const animalId = db.animals.insert({
    name: 'Gray Wolf',
    speed: 73
  });
  const personId = db.people.get({ name: like('Andrew%') }, 'id');
  db.sightings.insert({
    personId,
    animalId
  });
  db.commit();
}
catch (e) {
  db.rollback();
  throw e;
}
```

## Migrations

The client returned from ```getClient``` has three methods that can be used to create a migration system. This includes:

```getSchema```: return the tables loaded into the ```getClient``` method in a format suitable for saving as JSON.

```diff```: takes a saved schema and diffs it with the currently loaded schema to create a migration.

```migrate```: takes a SQL string representing the migration. This method defers the foreign keys and wraps the SQL in a transaction.

See the [sample project](https://github.com/andrewitsover/midnight-tutorial) for an example of how to use these functions to create a migration system.

## Creating tables

In addition to the built-in SQLite types of ```int```, ```real```, ```text```, and ```blob```, Midnight adds a few extra types. ```bool``` is stored in the database as a 1 or a 0, and ```json``` is a JSONB blob. 

```bigInt``` can be used instead of ```int``` for reading and writing large integers.

All of the Temporal date types are also available and stored as strings internally. This includes ```duration```, ```instant```, ```plainDate```, ```plainDateTime```, ```plainMonthDay```, ```plainTime```, ```plainYearMonth```, and ```zonedDateTime```.

To create a table, you simply extend either ```Table```, ```FTSTable```, or ```BaseTable```. ```Table``` automatically defines an integer primary key called ```id```. ```FTSTable``` is used for defining fts5 tables. Columns start with a lowercase letter.

```js
class Moons extends BaseTable {
  id = primary.int;
  name = unique(text);
  planetId = nil.cascade(Planets);
  discovered = now.instant;
}
```

Column types can be wrapped in many different methods:

```index```: add an index to the column.

```unique```: add a unique index to the column.

```init```: define a default value. You can often simply use a literal instead.

## Null columns

Standard columns, columns with default values, and foreign keys can be specified as potentially being null by using the built-in ```nil``` interface.

```js
class Animals extends Table {
  name = nil.text;
  spotted = nil.now.instant;
  forestId = nil.cascade(Forests);
}
```

## User-defined functions

User-defined functions can be defined in JavaScript and used in the same way as the built-in functions.

They can be used as default values

```js
import {
  Database,
  Table,
  primary,
  text,
  zonedDateTime
} from '@andrewitsover/midnight';

const database = new Database(':memory:');
const uuid = database.createFunction({
  returnType: primary.text,
  lambda: () => randomUUID()
});

class Rangers Extends Table {
  id = uuid();
  name = text;
  createdAt = zonedDateTime;
}
```

or in symbol queries.

```js
const compare = database.createFunction({
  returnType: int,
  options: {
    deterministic: true
  },
  lambda: (a, b) => {
    const { from, compare } = Temporal.ZonedDateTime;
    const d = from(a);
    const e = from(b);
    return compare(d, e);
  }
});

const now = Temporal.Now.zonedDateTimeISO();

const rangers = db.query(c => {
  const { rangers: r } = c;
  const compared = compare(r.createdAt, now);
  return {
    select: r,
    where: {
      [compared]: gte(0)
    }
  }
});
```

## Check constraints

Constraints can be represented as either an array of valid values using the ```in``` property, or with the ```is``` property.

```js
class Trees extends Table {
  height = int;
  leaves = check(int, { is: gte(0) });
  alive = true;
}
```

Constraints can also be defined in the ```Attributes``` function and span across multiple columns. If there is more than one constraint or index, the function should return an array.

```js
class Rangers extends Table {
  admin = false;
  staffLimit = 3;
  createdAt = now.instant;

  [attributes] = () => {
    return check({
      or: [
        { [this.admin]: true },
        { [this.staffLimit]: gt(0) }
      ]
    });
  }
}
```

## Foreign keys

Foreign keys do not need to specify a column type, as the type will be determined by the table that is referenced.

By default, an index is created for the foreign key, and the column is set to not null. You can use the ```Null`` function to make the foreign key optional. Also, the related column in the referenced table is assumed to be the primary key of that table.

```js
class Sightings extends Table {
  personId = cascade(People);
  animalId = cascade(Animals);
  date = now.zonedDateTime;
}

class Animals extends Table {
  name = text;
  ownerId = references(Sightings, {
    column: 'personId',
    index: false,
    onDelete: 'set null',
    onUpdate: 'cascade'
  });
}
```

```cascade``` is simply a shorthand version of ```references``` that has the ```onDelete``` property set to ```cascade```.

## Indexes

For indexes that span multiple columns or are based on expressions, you can define an ```attributes``` function on the class.

```js
class Trees extends Table {
  name = text;
  category = text;
  planted = now.instant;

  [attributes] = () => {
    const computed = cast(strfTime('%Y', this.planted), 'integer');
    return [
      index(computed),
      unique(this.name, this.category)
    ];
  }
}
```

## Partial indexes

Partial indexes can be defined on a class field.

```js
class Animals extends BaseTable {
  id = primary.int;
  name = index(text, name => ({
    where: {
      [name]: like('%Wolf')
    }
  }));
}
```

Indexes can also be defined inside the ```attributes``` function if they span across multiple columns.

```js
class Trees extends Table {
  name = text;
  forestId = references(Forests);
  alive = init(true);

  [attributes] = () => {
    return index(this.name, {
      [this.alive]: true
    });
  }
}
```

The above example applies a partial index on ```name``` where ```alive``` is ```true```.

## Computed fields

Computed fields use the built-in SQLite functions and therefore can be used in any part of a query.

```js
class Trees extends Table {
  name = text;
  category = nil.text;

  displayName = concat(this.name, ' (', this.category, ')');
}
```

## SQL queries in JavaScript

Midnight alllows you to create complex SQL queries without leaving JavaScript.

The following query uses a window function to rank trees by their height.

```js
const trees = db.query(c => {
  const { 
    id,
    name,
    height
  } = c.trees;
  return {
    select: {
      id,
      name,
      rank: rowNumber({
        orderBy: height,
        desc: true
      })
    },
    where: {
      [height]: gt(1)
    }
  }
});
```

The built-in SQLite functions are just JavaScript functions that can be imported like this:

```js
import { lt, gt, max, timeDiff } from '@andrewitsover/midnight';
```

This query gets the tree planted the furthest time away from the supplied date.

```js
const tree = db.first(c => {
  const { id, name, planted } = c.trees;
  const now = Temporal.Now.plainDateISO();
  const orderBy = max(timeDiff(planted, now));
  return {
    select: {
      id,
      name,
      max: orderBy
    },
    orderBy,
    desc: true
  }
});
```

The ```c``` parameter of the query represents the context of the database, including both tables and functions.

The ```group``` function represents ```json_group_array``` or ```json_group_object``` depending on the number of parameters supplied to the function. As a shortcut to ```group```, you can simply put selected items in an array.

```js
const moons = db.subquery(c => {
  const { id, name, planetId } = c.moons;
  return {
    select: {
      planetId,
      moons: [{
        id,
        name
      }]
    },
    having: {
      [count()]: gt(1)
    }
  }
});
```

There is also an ```object``` function, but it is usually easier to use the function notation to specify structured columns:

```js
const trees = db.query(c => {
  const { trees: t, forests: f } = c;
  return {
    select: {
      ...t,
      forest: () => ({
        id: f.id,
        name: f.name
      })
    }
  }
});
```

As the table columns are a special type of ```Symbol```, you can use them as keys in objects more than once:

```js
const now = Temporal.Now.zonedDateTimeISO();
const start = now.subtract({ days: 3 });
const trees = db.query(c => {
  const { trees: t } = c;
  return {
    select: t,
    where: {
      [t.planted]: gte(start),
      [t.planted]: lt(now)
    }
  }
});
```

If you want to create a subquery for use in many different queries, you can use the ```subquery``` method.

The query below creates a list of people that have sighted a particular ```animalId```.

```js
const sighted = db.subquery(c => {
  const { animalId } = c.sightings;
  return {
    select: {
      animalId,
      by: [c.people]
    }
  }
});
```

You can now use this subquery in other queries.

```js
const animals = db.query(c => {
  const { animals: a } = c;
  return {
    select: a,
    maybe: {
      sightedBy: sighted.by
    },
    where: {
      [length(a.name)]: gt(10)
    }
  }
});
```

Subqueries can also be used instead of tables in the standard API with the ```use``` method.

```js
const sightings = db.use(sighted).exists({ animalId: 1 });
```

The object returned from the ```query``` and ```subquery``` methods can include the following:

```select```, ```maybe```, ```certain```, ```distinct```, ```join```, ```where```, ```groupBy```, ```having```, ```orderBy```, ```desc```, ```limit```, and ```offset```.

```maybe```: the same as ```select``` but implies that these columns may be ```null```. This is useful for columns that come from a left join.

```js
const planets = db.query(c => {
  const { planets: p, moons: m } = c;
  return {
    select: p,
    maybe: {
      moon: m.name
    }
  }
});
```

In the above example, ```moon``` will be of type ```string``` or ```null``` even though it is normally not null.

```certain```: removes ```null``` from the column types.

```js
const user = db.first(c => {
  const { forests: f } = c;
  return {
    certain: {
      density: f.density
    },
    where: {
      [f.density]: not(null)
    }
  }
});
```

```distinct```: used instead of ```select``` when you want the results to be distinct.

```join```: represents the join clause and can take a number of forms. It can be a single tuple or object if there is only one join, or an array of these types if there is more than one. The object takes the same form as there ```where``` clause in other queries.

```js
const animalRangers = db.query(c => {
  const { forests: f, animals: a, rangers: r } = c;
  return {
    select: {
      animal: a.name,
      ranger: r.name
    },
    join: [
      [r.forestId, f.id],
      {
        or: [
          { [a.forestId]: r.forestId },
          and: [
            { [a.forestId]: null },
            { [r.role]: 'Supervisor' }
          ]
        ]
      }
    ]
  }
});
```

## Inferred joins

In most cases, the ```join``` and ```groupBy``` clauses can be inferred by the foreign key constraints and the use of the ```group``` function and ```maybe``` property if there are left joins.

When using ```json_group_array``` via the ```group``` function or array syntax, Midnight will add a ```groupBy``` statement if one is not supplied. If there is only one non-grouped column in the select statement, it will be used in the ```groupBy``` clause, otherwise the primary key of the first column will be used.

If there is a ```having``` clause with no ```groupBy``` clause, a ```groupBy``` clause will be added based on the same rules.

If exactly two tables are selected but there is no way to join them, Midnight will search for a join table to connect them.

Assuming an animal can have many forests, and a forest can have many animals:

```js
const animals = db.query(c => {
  const { animals: a } = c;
  return {
    select: {
      id: a.id,
      name: a.name,
      forests: [c.forests]
    }
  }
});
```

The above query will find the ```AnimalForests``` join table and group the rows by ```Animal.id```.

The below query will get all animals that live in exactly 2 forests.

```js
const animals = db.query(c => {
  const { animals: a, forests: f } = c;
  return {
    select: {
      id: a.id,
      name: a.name
    },
    having: {
      [count(f.id)]: 2
    }
  }
});
```

## Full-text search

The below example creates a fts5 table with three columns, one of which is only used for referencing other tables and so is removed from indexing.

```js
class Emails extends FTSTable {
  uuid = unindexed;
  to = text;
  body = text;
}
```

As all columns in a fts5 table are text, there is no need to specify the column type.

Specific tokenizers such as ```Unicode61```, ```Ascii```, and ```Trigram``` can be imported and passed into the ```Tokenizer``` field of the table class.

To define a fts5 table based on another table, you can do this:

```js
export class Forests extends Table {
  name = text;
  otherName = text;
}

const forest = new Forests();

export class ForestSearches extends ExternalFTSTable {
  name = forest.name;
  otherName = forest.otherName;
}
```

You can now query the table like this:

```js
const matches = db.forestSearches.match({
  startsWith: 'Mount'
});
```

If you want to search a specific column, you can do:

```js
const matches = db.forestSearches.match({
  where: {
    otherName: {
      near: ['Mount', 'Park', 2]
    }
  },
  limit: 3
});
```

The above query finds any forest with an ```otherName``` that contains the word "Mount" followed by a maximum of 2 tokens, and then the word "Park". As in, "Mount" is near "Park".

The ```match``` API allows you to search an fts5 table in a number of different ways.

```phrase```: match an exact phrase

```startsWith```: the specified column or any of the columns starts with a particular string.

```prefix```: any token starts with a particular string.

```near```: takes an array of two or more strings with the last value being a number that specifies the maximum number of tokens allowed between the matching strings.

```and```, ```or```, and ```not```: takes an array of strings.

You can also query fts5 tables with the basic API like this:

```js
const results = db.forestSearches.query({
  where: { 
    forestSearches: 'Mount'
  },
  highlight: {
    column: 'name',
    tags: ['<b>', '</b>']
  },
  bm25: {
    name: 1,
    otherName: 10
  },
  limit: 5
});
```

or the SQL-like API like this:

```js
const results = db.query(c => {
  const { 
    forests: f,
    forestSearches: s
  } = c;
  return {
    select: {
      name: f.name
    },
    where: {
      [s.forestSearches]: 'Mount'
    },
    bm25: {
      [s.name]: 1,
      [s.otherName]: 10
    },
    join: [f.id, s.rowid],
    limit: 5
  }
});
```

You can also use the ```rank``` keyword.

## Type helpers

To construct arguments outside of the methods themselves, you can use the ```Insert```, ```Where```, and ```Select``` types.

```ts
import { db } from './database';
import { Clouds } from './schema';
import { Insert } from '@andrewitsover/midnight';

const cloud: Insert<Clouds> = {
  name: 'Nimbus',
  orbit: 'Prograde'
};
const id = db.clouds.insert(cloud);
```

## Typed JSON

JSON columns can be typed using the ```typedArray``` and ```typedObject``` functions like this:

```js
class Moons extends Table {
  name = text;
  researchPapers = typedArray({
    id: int,
    contents: text,
    createdAt: nil.text,
    authors: typedArray(text)
  });
}
```

You should only use the types that are supported natively by JSON as the fields inside the objects are not parsed by Midnight.
