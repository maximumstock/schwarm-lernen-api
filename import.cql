// cleanup
match (n) optional match (n)-[r]-() delete r,n;

// Hauptlernziel
create (t:Target:EntryTarget {name: "Informatik"});
match (t:Target:EntryTarget) create (t)<-[:BELONGS_TO]-(c:Config {packageSize: 10, taskShare: 0.25, infoShare: 0.15, solutionShare: 0.50, rateShare: 0.1, tasksToDo: 2, solutionsToDo: 4, ratingsToDo: 5, infosToDo: 4, infoPoints: 1, taskPoints: 2, solutionPoints: 3, ratePoints: 1, rateMultiplier: 1});

// 10 Targets für Informatik
match (d:Degree) with range(1,10) as RANGE, d foreach(r in RANGE | create (n:Target)-[:PART_OF]->(d));
// 3 Targets pro Level1-Target (10*3 + 10)
//match (t:Target) with range(1,3) as RANGE, t foreach(r in RANGE | create (n:Target)-[:PART_OF]->(t));
// 3 Targets pro Level2-Target (10*3*3 + 10*3 + 10)
//match (t:Target)-[:PART_OF]->(t2:Target) with range(1,3) as RANGE, t foreach(r in RANGE | create (n:Target)-[:PART_OF]->(t));

// User mit Zugang
//match (d:Degree {name: "Informatik"}) with range(1,20) as RANGE, d foreach(r in RANGE | create (u:User {username: toint(rand()*100)})-[:HAS_ACCESS]->(d));


////////////////////////////////////////////////////////////////////////////////////////
// TEST STUFF
// DELETE IN PRODUCTION
match (t:Target:EntryTarget)
create
  (u:User:Admin {username: "admin", password: "admin"})-[:HAS_ACCESS]->(t),
  (u2:User {username: "bene", password: "bene"})-[:HAS_ACCESS]->(t),
  (u3:User {username: "test", password: "test"});
/////////////////////////////////////////////////////////////////////////////////////////

// Aufgaben
//match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Target) where rand() < 0.1 create (u)-[:CREATED]->(ta:Task {description: "Task #" + toint(round(rand()*100)), author: u.uuid})-[:BELONGS_TO]->(t);

// Infos
//match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Target) where rand() < 0.1 create (u)-[:CREATED]->(i:Info {description: "Info #" + toint(round(rand()*100)), author: u.uuid})-[:BELONGS_TO]->(t);

// Lösungen
//match (u:User)-[:HAS_ACCESS]-(d:Degree), (t:Task) where rand() < 0.05 create (u)-[:CREATED]->(s:Solution {description: "Lösung #" + toint(round(rand()*100)), author: u.uuid})-[:SOLVES]->(t);

// Kommentare und Ratings
//match (u:User)-[:HAS_ACCESS]-(d:Degree), (s) where (s:Solution or s:Task or s:Info) and rand() < 0.05
//  create unique (u)-[:RATES {r1: toint(round(((rand()*100)%5+1))),r2: toint(round(((rand()*100)%5+1))),r3: toint(round(((rand()*100)%5+1))), comment: "LOLOLO ich bin der jürgen"}]->(s);
//match (u:User)-[:HAS_ACCESS]-(d:Degree), (s) where (s:Solution or s:Task or s:Info) and rand() < 0.05
//  create (u)-[:CREATED]->(c:Comment {text: "Dies ist ein Kommentar"})-[:BELONGS_TO]->(s);

// jeglicher erstellter Content darf nicht vom Ersteller bewertet werden -> Löschen aller solcher Bewertungen aus Testdaten
//match (u:User)-[:CREATED]->()<-[r:RATES]-(u) delete r;

// mehrfache Lösungen löschen (anscheinend nicht nötig)
//match (u:User)-[r1:CREATED]->(s:Solution)<-[r2:SOLVES]-(t:Task)
//foreach (r in rels1 | delete r)
//with collect(r1)[1..] as rels1, collect(r2)[1..] as rels2, collect(s)[1..] as solutions
//foreach (r in rels2 | delete r)
//foreach (s in solutions | delete s);

// User ohne Zugang
//with range(1,5) as RANGE foreach(r in RANGE | create (u:User {username: toint(rand()*100)}));
