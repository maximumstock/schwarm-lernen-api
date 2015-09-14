// cleanup
match (n) optional match (n)-[r]-() delete r,n;

// Degree
create (d:Degree {name: "Informatik"});
// 10 Targets für Informatik
match (d:Degree) with range(1,10) as RANGE, d foreach(r in RANGE | create (n:Target)-[:PART_OF]->(d));
// 3 Targets pro Level1-Target (10*3 + 10)
match (t:Target) with range(1,3) as RANGE, t foreach(r in RANGE | create (n:Target)-[:PART_OF]->(t));
// 3 Targets pro Level2-Target (10*3*3 + 10*3 + 10)
match (t:Target)-[:PART_OF]->(t2:Target) with range(1,3) as RANGE, t foreach(r in RANGE | create (n:Target)-[:PART_OF]->(t));

// User mit Zugang
match (d:Degree {name: "Informatik"}) with range(1,20) as RANGE, d foreach(r in RANGE | create (u:User {username: toint(rand()*100)})-[:HAS_ACCESS]->(d));


////////////////////////////////////////////////////////////////////////////////////////
// TEST STUFF
// DELETE IN PRODUCTION
match (d:Degree)
create
  (u:User:Admin {username: "admin", password: "admin"})-[:HAS_ACCESS]->(d),
  (u2:User {username: "bene", password: "bene"})-[:HAS_ACCESS]->(d),
  (u3:User {username: "test", password: "test"});
/////////////////////////////////////////////////////////////////////////////////////////

// Aufgaben
match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Target) where rand() < 0.1 create (u)-[:CREATED]->(ta:Task {description: "Task #" + toint(round(rand()*100)), author: u.uuid})-[:BELONGS_TO]->(t);

// Infos
match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Target) where rand() < 0.1 create (u)-[:CREATED]->(i:Info {description: "Info #" + toint(round(rand()*100)), author: u.uuid})-[:BELONGS_TO]->(t);

// Lösungen
match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Task) where rand() < 0.05 create (u)-[:CREATED]->(s:Solution {description: "Lösung #" + toint(round(rand()*100)), author: u.uuid})-[:SOLVES]->(t);

// Kommentare und Ratings
match (u:User)-[:HAS_ACCESS]-(d:Degree), (s) where (s:Solution or s:Task or s:Info) and rand() < 0.05
  create unique (u)-[:RATES {rating: toint(round(((rand()*100)%5+1)))}]->(s);
match (u:User)-[:HAS_ACCESS]-(d:Degree), (s) where (s:Solution or s:Task or s:Info) and rand() < 0.05
  create (u)-[:CREATED]->(c:Comment {text: "Dies ist ein Kommentar"})-[:BELONGS_TO]->(s);

// jeglicher erstellter Content darf nicht vom Ersteller bewertet werden -> Löschen aller solcher Bewertungen aus Testdaten
match (u:User)-[:CREATED]->()<-[r:RATES]-(u) delete r;

// mehrfache Lösungen löschen (anscheinend nicht nötig)
match (u:User)-[r1:CREATED]->(s:Solution)<-[r2:SOLVES]-(t:Task)
with collect(r1)[1..] as rels1, collect(r2)[1..] as rels2, collect(s)[1..] as solutions
foreach (r in rels1 | delete r)
foreach (r in rels2 | delete r)
foreach (s in solutions | delete s);

// User ohne Zugang
with range(1,5) as RANGE foreach(r in RANGE | create (u:User {username: toint(rand()*100)}));
