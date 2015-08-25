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
match (d:Degree {name: "Informatik"}) with range(1,20) as RANGE, d foreach(r in RANGE | create (u:User)-[:HAS_ACCESS]->(d));

// Aufgaben
match (u:User), (t:Target) where rand() < 0.05 create (u)-[:CREATED]->(ta:Task)-[:BELONGS_TO]->(t);
// Bewertungen mit Rating zwischen 1-5 und Kommentare
match (u:User), (t:Task) where rand() < 0.01 create unique (u)-[:RATES {rating: (rand()%5+1)}]->(t);
match (u:User), (t:Task) where rand() < 0.01 create unique (u)-[:COMMENTS {text: "Dies ist ein Kommentar"}]->(t);

// Infos
match (u:User), (t:Target) where rand() < 0.01 create (u)-[:CREATED]->(i:Info)-[:BELONGS_TO]->(t);
// Bewertungen mit Rating zwischen 1-5 und Kommentare
match (u:User), (i:Info) where rand() < 0.01 create unique (u)-[:RATES {rating: (rand()%5+1)}]->(i);
match (u:User), (i:Info) where rand() < 0.01 create unique (u)-[:COMMENTS {text: "Dies ist ein Kommentar"}]->(i);

// Lösungen
match (u:User), (t:Task) where rand() < 0.05 create (u)-[:CREATED]->(s:Solution)-[:SOLVES]->(t);
// Bewertungen mit Rating zwischen 1-5 und Kommentare
match (u:User), (s:Solution) where rand() < 0.1 create unique (u)-[:RATES {rating: (rand()%5+1)}]->(s);
match (u:User), (s:Solution) where rand() < 0.1 create unique (u)-[:COMMENTS {text: "Dies ist ein Kommentar"}]->(s);

// jeglicher erstellter Content darf nicht vom Ersteller bewertet werden -> Löschen aller Bewertungen aus Testdaten
match (u:User)-[:CREATED]->()<-[r:RATES]-(u) delete r;

// mehrfache Lösungen löschen (anscheinend nicht nötig)
match (u:User)-[r1:CREATED]->(s:Solution)<-[r2:SOLVES]-(t:Task)
with collect(r1)[1..] as rels1, collect(r2)[1..] as rels2, collect(s)[1..] as solutions
foreach (r in rels1 | delete r)
foreach (r in rels2 | delete r)
foreach (s in solutions | delete s);

// User ohne Zugang
with range(1,5) as RANGE foreach(r in RANGE | create (u:User));
