npm install drizzle-orm drizzle-kit pg

make the scehma like this-> 

```javascript
import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const user2 = pgTable('user2', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email'),
});
```

now use inside the controller-> 

```java
import db from './db/index.js';
import { user2 } from './schema/user.js';

const result = await db.select().from(user2);
console.log(result);
```` 

### To push new table of drizzle to pg db
! make sure to delete prisma_migration file, drizzle will delete it
* make the drizzle.config.js and specify the schema folder location e.g. ./src/schema
npx drizzle-kit push

{
  *Note if you have this error ->error: function uuid_generate_v4() does not exist ,
  in psql run this -> CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 
}

### To pull already created database's tables-> 
* for this just give the dr_url at .env
npx drizzle-kit pull


### to run the drizzle-kit studio
npx drizzle-kit studio --port 3000 --verbose  





// common operators
| **Drizzle** | **SQL Equivalent** | **Meaning**           |
| ----------- | ------------------ | --------------------- |
| `eq(a, b)`  | `a = b`            | Equal                 |
| `ne(a, b)`  | `a <> b`           | Not equal             |
| `gt(a, b)`  | `a > b`            | Greater than          |
| `lt(a, b)`  | `a < b`            | Less than             |
| `gte(a, b)` | `a >= b`           | Greater than or equal |
| `lte(a, b)` | `a <= b`           | Less than or equal    |


// string operators
| **Drizzle**   | **SQL Equivalent** | **Meaning**                    |
| ------------- | ------------------ | ------------------------------ |
| `like(a, b)`  | `a LIKE b`         | Case-sensitive partial match   |
| `ilike(a, b)` | `a ILIKE b`        | Case-insensitive partial match |

// logical oeprators
| **Drizzle**           | **SQL Equivalent**  | **Meaning**                 |
| --------------------- | ------------------- | --------------------------- |
| `and([cond1, cond2])` | `(cond1 AND cond2)` | All conditions must be true |
| `or([cond1, cond2])`  | `(cond1 OR cond2)`  | Any condition can be true   |
| `not(cond)`           | `NOT (cond)`        | Negate condition            |



### Join operation
import { ilike } from "drizzle-orm/expressions"; // for case-insensitive LIKE

const result = await db
  .select({
    username: users.username,
    videoTitle: videos.title,
  })
  .from(users)
  .where(eq(users.id, "some-user-id")); // condition
  .leftJoin(videos, eq(users.id, videos.userId))
  .innerJoin(comments, eq(videos.id, comments.videoId))
  .where(ilike(users.username, '%john%')) // ← WHERE clause
  .groupBy(videos.userId)
  .having(gt(sql<number>`COUNT(*)`, 5)) // ← HAVING clause
  .orderBy(users.createdAt)
  .limit(10)
  .offset(20)
  .returning({    
    id: users.id,
    username: users.username,
    email: users.email,
    fullName: users.fullName,
    coverImage : users.coverImage,
    createdAt : users.createdAt,
    updatedAt : users.updatedAt,
    avatar: users.avatar
    }
  );

.returning() -> returns all the colums
.select()-> selects all the column


(returning is for insert/update):

  Above query is just for representation purpose only

  *** if you name columns like fullName,postgress converts it to the full_name i.e. sanke casing, and if you use drizzle to query db and write db.query(users).where({fullName})... it wil auto. convert it to the snake casing...


// const user = await db.execute(
//     sql`SELECT * FROM users WHERE username = ${username} and email = ${email}`
//     );


    // {
    //   rows: [ 
    //     {
    //       id: 'uuid-string',
    //       username: 'john_doe',
    //       email: 'john@example.com',
    //       fullName: 'John Doe',
    //       password: 'hashed_password',
    //       avatar: 'https://cloudinary.com/avatar.jpg',
    //       coverImage: 'https://cloudinary.com/cover.jpg',
    //       createdAt: Date,
    //       updatedAt: Date
    //     }
    //   ],
    //   rowCount: 1,
    //    other metadata depending on driver (optional)
    // }
