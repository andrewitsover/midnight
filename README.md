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
The time after the 11th hour. Midnight is a NodeJS ORM for SQLite and Turso with full TypeScript support without needing to generate any code. Even complex SQL queries can be written inside of JavaScript.

Tables are written in JavaScript like this:

```js
class Forests extends Table {
  name = this.Text;
  address = this.Text;

  displayName = this.Concat(this.name, ' - ', this.address);
}

class Trees extends Table {
  name;
  planted = this.Index(this.Date);
  forestId = this.Cascade(Forests);
  alive = this.True;
}
```

There are two levels of API. The first is a table-level syntax for basic queries.

```js
const tree = await db.trees.get({ 
  id: 1,
  alive: true
});
```

The second type of syntax is much like SQL and builds on many of the new features that JavaScript has added to its language in recent times.

```js
const trees = await db.query(c => {
  const {
    forests: f,
    trees: t
  } = c;
  return {
    select: {
      ...t,
      forest: f.name
    },
    join: [t.forestId, f.id],
    where: {
      [t.id]: [1, 2, 3]
    }
  }
});
```

This syntax allows you to perform queries that usually aren't possible in ORMs.

## Getting started

### Prerequists

Make sure you have installed [Node.js](https://nodejs.org/en) version 22.13.1 or higher.

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
import { SQLiteDatabase, Table } from '@andrewitsover/midnight';

const database = new SQLiteDatabase('forest.db');

class Clouds extends Table {
  name;
};

const db = database.getClient({ Clouds });
const sql = db.diff();
await db.migrate(sql);

await db.clouds.insert({ name: 'Nimbus' });
const clouds = await db.clouds.many();
console.log(clouds);
```

To run it, you can use ```node main.js``` from the project root directory.

See the [sample project](https://github.com/andrewitsover/midnight-tutorial) for a more complete setup.

## The API

Every table has ```get```, ```many```, ```first```, ```query```, ```update```, ```upsert```, ```insert```, ```insertMany```, and ```delete``` methods available to it.

### Insert

```insert``` inserts a row into the database. For batch inserts you can use ```insertMany```, which takes an array of objects.

```js
const id = await db.moons.insert({
  name: 'Europa',
  orbit: 'Retrograde'
});
```

### Update

```update``` takes an object with an optional ```where``` property, and a ```set``` property. It returns a number representing the number of rows that were affected by the query. For example:

```js
await db.moons.update({
  where: { id: 100 }, 
  set: { orbit: 'Prograde' }
});
```

If you want to update columns based on their existing value, you can pass a function into the ```set``` properties like this:

```js
await db.moons.update({
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

```upsert``` will update the row if the target's uniqueness contraint is violated by the insert. If ```target``` or ```set``` are not provided, the upsert will do nothing when there is a conflict. ```upsert``` returns the primary key of the inserted or updated row.

```js
const id = await db.forests.upsert({
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
const trees = await db.trees.many({ 
  forestId: 9,
  alive: true
});
```

If an array is passed in, an ```in``` clause is used, such as:

```js
const trees = await db.trees.many({
  forestId: [1, 2, 3]
});
```

If null is passed in as the value, the SQL will use ```is null```.

The second argument to ```get``` or ```many``` selects which columns to return. It can be one of the following:

1. a string representing a column to select. In this case, the result returned is a single value or array of single values, depending on whether ```get``` or ```many``` is used.

```js
const planted = await db.trees.get({ id: 3 }, 'planted');
```

2. an array of strings, representing the columns to select.

```js
const tree = await db.trees.get({ id: 3 }, ['id', 'born']);
```

### Query and First

You can use the ```query``` or ```first``` syntax for more complex queries. ```query``` returns an array in the same way as ```many```, and ```first``` returns an object or ```undefined``` if nothing is found. The additional keywords are:

```select```: an array of strings representing the columns to select.

```return```: a string representing the column to select.

```omit```: a string or array of strings representing the columns to omit. All of the other columns will be selected.

```js
const rangers = await db.rangers.query({
  omit: 'password',
  where: {
    id: [1, 2, 3]
  }
});
```

```orderBy```: a string or an array representing the column or columns to order the result by. This can also be a function that utilises the built-in SQLite functions.

```js
const trees = await db.trees.query({
  where: {
    category: 'Evergreen'
  },
  orderBy: (c, f) => f.lower(c.name)
});
```

```desc```: set to true when using ```orderBy``` if you want the results in descending order.

```limit``` and ```offset```: corresponding to the SQL keywords with the same name.

```distinct```: adds the ```distinct``` keywords to the start of the select clause.

For example:

```js
const trees = await db.trees.query({
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
const moons = await db.moons.many({ id: c => c.not(excluded) });
const count = await db.moons.count({
  where: {
    id: c => c.gt(10)
  }
});
```

### Complex filtering

If you need to perform complex logic in the ```where``` clause, you can use the ```and``` or ```or``` properties. For example:

```js
const wolves = await db.animals.query({
  where: {
    or: [
      { name: c => c.like('Gray%') },
      { id: c => c.lt(10) },
      {
        and: [
          { tagged: c => c.gt(time) },
          { name: c => c.like('Red%') }
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
const count = await db.trees.count({
  where: {
    native: true
  }
});
```

There is also an ```exists``` function that takes one argument representing the where clause.

```js
const exists = await db.moons.exists({ 
  name: 'Cumulus'
});
```

### GroupBy

You can write ```group by``` statements like this:

```js
const trees = await db.fighters
  .groupBy('forestId')
  .avg({
    column: {
      height: 'heightCm'
    },
    where: {
      avg: c => c.gt(170)
    },
    limit: 3
  });
```

An aggregate function should come after the ```groupBy``` method. ```distinct``` can be used instead of ```column``` to aggregate by distinct values. ```distinct``` or ```column``` needs to be an object with a single property representing the alias for the aggregrate function, and the column to aggregate by.

In addition to aggregate functions such as ```avg``` or ```count```, there is also an ```array``` function that simply groups the rows into an array. The ```select``` option takes an object with a single property representing the name of the resulting array, and the column or columns to select.

```js
const trees = await db.trees
  .groupBy('forestId')
  .array({
    select: {
      planted: 'planted'
    },
    limit: 3
  });
```

### Delete

```delete``` takes one argument representing the where clause and returns the number of rows affected by the query.

```js
const changes = await db.moons.delete({ id: 100 });
```

## Transactions

Transactions lock all writes to the database until they are complete.

```js
const tx = await db.begin();
try {
  const animalId = await tx.animals.insert({
    name: 'Gray Wolf',
    speed: 73
  });
  const personId = await tx.people.get({ name: c => c.like('Andrew%') }, 'id');
  await tx.sightings.insert({
    personId,
    animalId
  });
  await tx.commit();
}
catch (e) {
  await tx.rollback();
}
```

## Batches

You can also run multiple statements inside a single transaction without any logic using ```batch```.

```js
const forestId = 1;
const [forest, trees, sightings] = await db.batch((bx) => [
  bx.forests.get({ id: forestId }),
  bx.trees.many({ forestId }),
  bx.sightings.many({ forestId })
]);

const result = { ...forest, trees, sightings };
```

## Migrations

The client returned from ```getClient``` has three methods that can be used to create a migration system. This includes:

```getSchema```: return the tables loaded into the ```getClient``` method in a format suitable for saving as JSON.

```diff```: takes a saved schema and diffs it with the currently loaded schema to create a migration.

```migrate```: takes a SQL string representing the migration. This method defers the foreign keys and wraps the SQL in a transaction.

See the [sample project](https://github.com/andrewitsover/midnight-tutorial) for an example of how to use these functions to create a migration system.

## Creating tables

In addition to the built-in SQLite types of ```Integer```, ```Real```, ```Text```, and ```Blob```, Midnight adds a few extra types. ```Boolean``` is stored in the database as a 1 or a 0, ```Date``` is stored as an ISO8601 string, and ```Json``` is a JSONB blob.

To create a table, you simply extend either ```Table```, ```FTSTable```, or ```BaseTable```. ```Table``` automatically defines an integer primary key called ```id```. ````FTSTable``` is used for defining fts5 tables. Columns start with a lowercase letter.

```js
class Moons extends BaseTable {
  id = this.IntPrimary;
  name = this.Unique(this.Text);
  planetId = this.Cascade(Planets);
  discovered = this.Now;
}
```

To specify the primary key, you use one of the modified types that has ```Primary``` at the end.

Column types can be wrapped in many different methods:

```Null```: assert that the column can contain nulls.

```Index```: add an index to the column.

```Unique```: add a unique index to the column.

```Default```: this is only needed for TypeScript, and is used to define a default value. JavaScript users do not need to use this.

## Check constraints

Constraints can be represented as either an array of valid values, or one or more comparison functions.

```js
class Trees extends Table {
  height = this.Int;
  leaves = this.Check(this.Int, this.Gte(0));
  alive = true;
}
```

Constraints can also be defined in the ```Attributes``` function and span across multiple columns.

```js
class Rangers extends Table {
  admin = this.False;
  staffLimit = this.Default(3);
  createdAt = this.Now;

  Attributes = () => {
    this.Check({
      or: [
        { [this.admin]: true },
        { [this.staffLimit]: this.Gt(0) }
      ]
    });
  }
}
```

## Foreign keys

Foreign keys do not need to specify a column type, as the type will be determined by the table that is referenced.

By default, an index is created for the foreign key, and the column is set to not null. Also, the related column in the referenced table is assumed to be the primary key of that table.

```js
class Sightings extends Table {
  personId = this.Cascade(People);
  animalId = this.Cascade(Animals);
  date = this.Now;
}

class Animals extends Table {
  name = this.Text;
  ownerId = this.References(Sightings, {
    column: 'personId',
    notNull: false,
    index: false,
    onDelete: 'set null',
    onUpdate: 'cascade'
  });
}
```

```Cascade``` is simply a shorthand version of ```References``` that has the ```onDelete``` property set to ```cascade```.

## Indexes

For indexes that span multiple columns or are based on expressions, you can define an ```Attributes``` function on the class.

```js
class Trees extends Table {
  id = this.IntPrimary;
  name;
  category;
  planted = this.Now;

  Attributes = () => {
    const computed = this.Cast(this.StrfTime('%Y', this.planted), 'integer');
    this.Index(computed);
    this.Unique(this.name, this.category);
  }
}
```

## Partial indexes

Partial indexes can be defined on a class field.

```js
class Animals extends Table {
  id = this.IntPrimary;
  name = this.Index(this.Text, name => {
    return {
      [name]: this.Like('%Wolf')
    }
  });
}
```

Indexes can also be defined inside the ```Attributes``` function if they span across multiple columns.

```js
class Trees extends Table {
  id = this.IntPrimary;
  name;
  forestId = this.References(Forests);
  alive = this.True;

  Attributes = () => {
    this.Index(this.name, {
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
  id = this.IntPrimary;
  name = this.Text;
  category = this.Text;

  displayName = this.Concat(this.name, ' (', this.category, ')');
}
```

## SQL queries in JavaScript

Midnight alllows you to create complex SQL queries without leaving JavaScript.

The following query uses a window function to rank trees by their height.

```js
const trees = await db.query(c => {
  const { 
    id,
    name,
    height
  } = c.trees;
  return {
    select: {
      id,
      name,
      rank: c.rowNumber({
        orderBy: height,
        desc: true
      })
    },
    where: {
      [height]: c.gt(1)
    }
  }
});
```

The built-in SQLite functions are just JavaScript functions. This query gets the tree planted the furthest time away from the supplied date.

```js
const tree = await db.first(c => {
  const { id, name, planted } = c.trees;
  const now = new Date();
  const max = c.max(c.timeDiff(planted, now));
  return {
    select: {
      id,
      name,
      max
    },
    orderBy: max,
    desc: true
  }
});
```

The ```c``` parameter of the query represents the context of the database, including both tables and functions.

The ```group``` function represents ```json_group_array``` or ```json_group_object``` depending on the number of parameters supplied to the function.

```js
const moons = await db.subquery(c => {
  const { id, name, planetId } = c.moons;
  return {
    select: {
      planetId,
      moons: c.group({
        id,
        name
      })
    },
    groupBy: planetId,
    having: {
      [c.count()]: c.gt(1)
    }
  }
});
```

If you want to create a subquery for use in many different queries, you can use the ```subquery``` method.

The query below creates a list of people that have sighted a particular ```animalId```.

```js
const sighted = db.subquery(c => {
  const { personId, animalId } = c.sightings;
  const p = c.people;
  return {
    select: {
      animalId,
      sightedBy: c.group(p)
    },
    join: [personId, p.id],
    groupBy: animalId
  }
});
```

You can now use this subquery in other queries.

```js
const animals = await db.query(c => {
  const { animalId, sightedBy } = c.use(sighted);
  const a = c.animals;
  return {
    select: {
      ...a,
      sightedBy
    },
    where: {
      [c.length(a.name)]: c.gt(10)
    },
    join: [a.id, animalId, 'left']
  }
});
```

Subqueries can also be used instead of tables in the stanadard API with the ```use``` method.

```js
const sightings = await db.use(sighted).exists({ animalId: 1 });
```

The object returned from the ```query``` and ```subquery``` methods can include the following:

```select```, ```optional```, ```distinct```, ```join```, ```where```, ```groupBy```, ```having```, ```orderBy```, ```desc```, ```limit```, and ```offset```.

```optional```: the same as ```select``` but provides hints to TypeScript that these columns may be ```null```. This is useful for columns that come from a left join.

```js
const planets = await db.query(c => {
  const { planets: p, moons: m } = c;
  return {
    select: p,
    optional: {
      moon: m.name
    }
    join: [p.id, m.planetId, 'left']
  }
});
```

In the above example, ```moon``` will be of type ```string``` or ```null``` even though it is normally not null.

```distinct```: used instead of ```select``` when you want the results to be distinct.

```join```: a tuple or array of tuples representing the keys to join on.

## Full-text search

The below example creates a fts5 table with three columns, one of which is only used for referencing other tables and so is removed from indexing.

```js
class Emails extends FTSTable {
  uuid = this.Unindex();
  to;
  body;
}
```

As all columns in a fts5 table are text, there is no need to specify the column type.

Specific tokenizers such as ```Unicode61```, ```Ascii```, and ```Trigram``` can be imported and passed into the ```Tokenizer``` field of the table class.

To define a fts5 table based on another table, you can do this:

```js
export class Forests extends Table {
  name;
  otherName;
}

const forest = new Forests();

export class ForestSearches extends ExternalFTSTable {
  name = forest.name;
  otherName = forest.otherName;
}
```

You can now query the table like this:

```js
const matches = await db.forestSearches.match({
  startsWith: 'Mount'
});
```

If you want to search a specific column, you can do:

```js
const matches = await db.forstSearches.match({
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
const results = await db.forestSearches.query({
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
const results = await db.query(c => {
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
